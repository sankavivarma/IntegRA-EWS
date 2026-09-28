import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from database import get_projects_df

class InfrastructureMLEngine:
    def __init__(self):
        self.risk_classifier = None
        self.cost_regressor = None
        self.delay_regressor = None
        self.sector_encoder = LabelEncoder()
        self.clearance_encoder = LabelEncoder()
        self.contractor_encoder = LabelEncoder()
        self.feature_names = []
        self.is_trained = False

    def _prepare_features(self, df: pd.DataFrame, is_training: bool = False):
        """Transform dataframe into robust feature matrix"""
        data = df.copy()

        # Default columns dictionary
        defaults = {
            'original_cost': 1000.0,
            'expenditure_to_date': 0.0,
            'original_duration_months': 36,
            'delay_months': 0,
            'physical_progress': 0.0,
            'land_acquired_pct': 100.0,
            'sector': 'General',
            'environmental_clearance': 'Approved',
            'contractor_risk': 'Low'
        }

        for col, val in defaults.items():
            if col not in data.columns:
                data[col] = val

        # Numerical Conversions
        for num_col in ['original_cost', 'expenditure_to_date', 'original_duration_months', 'delay_months', 'physical_progress', 'land_acquired_pct']:
            data[num_col] = pd.to_numeric(data[num_col], errors='coerce').fillna(defaults[num_col])

        # Derived engineering features
        orig_cost = np.maximum(data['original_cost'].values, 1.0)
        orig_dur = np.maximum(data['original_duration_months'].values, 1.0)
        phys_prog = np.clip(data['physical_progress'].values, 0.0, 100.0) / 100.0

        # Burn rate / execution efficiency safely computed
        safe_phys_prog = np.where(phys_prog > 0.01, phys_prog, 1.0)
        burn_rate = np.where(
            phys_prog > 0.01,
            (data['expenditure_to_date'].values / orig_cost) / safe_phys_prog,
            1.0
        )
        data['burn_rate_ratio'] = np.nan_to_num(burn_rate, nan=1.0, posinf=2.0, neginf=1.0)
        data['time_elapsed_ratio'] = (data['original_duration_months'].values + data['delay_months'].values) / orig_dur
        data['land_deficit_pct'] = 100.0 - np.clip(data['land_acquired_pct'].values, 0, 100)
        data['schedule_slip_rate'] = data['delay_months'].values / orig_dur

        # Categorical Encodings
        if is_training:
            known_sectors = list(set(data['sector'].astype(str).tolist() + ['Other', 'General', 'Railways', 'Road Transport & Highways', 'Urban Development', 'Petroleum & Natural Gas', 'Atomic Energy', 'Shipping', 'Water Resources', 'Civil Aviation', 'Fertilizers']))
            self.sector_encoder.fit(known_sectors)
            self.clearance_encoder.fit(['Approved', 'Pending', 'Conditional', 'Under Review'])
            self.contractor_encoder.fit(['Low', 'Medium', 'High', 'Critical'])

        def safe_transform(encoder, series, fallback=0):
            classes = {c.lower(): i for i, c in enumerate(encoder.classes_)}
            return series.astype(str).map(lambda x: classes.get(str(x).lower(), fallback))

        data['sector_code'] = safe_transform(self.sector_encoder, data['sector'])
        data['clearance_code'] = safe_transform(self.clearance_encoder, data['environmental_clearance'])
        data['contractor_code'] = safe_transform(self.contractor_encoder, data['contractor_risk'])

        features = [
            'original_cost', 'expenditure_to_date', 'original_duration_months',
            'delay_months', 'physical_progress', 'land_acquired_pct',
            'burn_rate_ratio', 'time_elapsed_ratio', 'land_deficit_pct',
            'schedule_slip_rate', 'sector_code', 'clearance_code', 'contractor_code'
        ]
        
        self.feature_names = features
        X = data[features].fillna(0)
        return X

    def train_models(self):
        """Train models on projects in SQLite"""
        df = get_projects_df()
        if df.empty or len(df) < 3:
            return False

        X = self._prepare_features(df, is_training=True)

        # Target 1: Risk Level (Classification)
        y_risk = df['risk_level'].fillna('Medium').astype(str)
        self.risk_classifier = RandomForestClassifier(n_estimators=60, random_state=42, max_depth=6)
        self.risk_classifier.fit(X, y_risk)

        # Target 2: Revised Cost / Cost Overrun (Regression)
        y_cost = pd.to_numeric(df['revised_cost'], errors='coerce').fillna(df['original_cost'])
        self.cost_regressor = RandomForestRegressor(n_estimators=60, random_state=42, max_depth=6)
        self.cost_regressor.fit(X, y_cost)

        # Target 3: Predicted Additional Delay (Regression)
        y_delay = pd.to_numeric(df['delay_months'], errors='coerce').fillna(0)
        self.delay_regressor = RandomForestRegressor(n_estimators=60, random_state=42, max_depth=6)
        self.delay_regressor.fit(X, y_delay)

        self.is_trained = True
        return True

    def predict_project_risk(self, project_dict: dict):
        """
        Run Scikit-Learn inference on input parameters.
        Returns:
            - risk_score: 0 - 100 percentage
            - risk_level: Low / Medium / High
            - predicted_cost: ₹ Cr
            - cost_overrun_pct: %
            - predicted_delay_months: months
            - key_reasons: List of top explainable factors with contribution %
        """
        if not self.is_trained:
            self.train_models()

        df_input = pd.DataFrame([project_dict])
        X = self._prepare_features(df_input, is_training=False)

        # 1. Cost & Delay Predictions
        orig_cost = float(project_dict.get('original_cost', 1000) or 1000)
        
        if self.cost_regressor is not None:
            pred_cost = float(self.cost_regressor.predict(X)[0])
            pred_cost = max(pred_cost, orig_cost) # cost never shrinks below original budget
        else:
            pred_cost = orig_cost * 1.25

        if self.delay_regressor is not None:
            pred_delay = int(round(float(self.delay_regressor.predict(X)[0])))
            curr_delay = int(project_dict.get('delay_months', 0) or 0)
            pred_delay = max(pred_delay, curr_delay)
        else:
            pred_delay = int(project_dict.get('delay_months', 0) or 0) + 6

        overrun_pct = round(((pred_cost - orig_cost) / max(orig_cost, 1)) * 100.0, 1)

        # 2. Risk Level & Risk Probability Score
        if self.risk_classifier is not None:
            proba = self.risk_classifier.predict_proba(X)[0]
            classes = list(self.risk_classifier.classes_)
            
            # Map probabilities to composite risk score
            class_weights = {'Low': 0.18, 'Medium': 0.55, 'High': 0.88}
            risk_score_norm = sum(proba[i] * class_weights.get(classes[i], 0.5) for i in range(len(classes)))
            risk_score = round(float(risk_score_norm * 100.0), 1)
            
            # Categorize
            if risk_score < 40:
                risk_level = "Low"
            elif risk_score < 68:
                risk_level = "Medium"
            else:
                risk_level = "High"
        else:
            risk_score = 45.0
            risk_level = "Medium"

        # 3. Explainability: Identify Top Reasons / Contributing Factors
        key_reasons = self._explain_risk_factors(project_dict, overrun_pct, pred_delay)

        # 4. Actionable Recommendations & Mitigation Strategies
        recommendations = self._generate_mitigation_recommendations(project_dict, risk_score, risk_level, overrun_pct, pred_delay)

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "predicted_cost": round(pred_cost, 2),
            "cost_overrun_pct": overrun_pct,
            "predicted_delay_months": pred_delay,
            "key_reasons": key_reasons,
            "recommendations": recommendations,
            "model_engine": "AI Predictive Ensemble Engine (Scikit-Learn Random Forest)"
        }

    def _explain_risk_factors(self, data: dict, overrun_pct: float, delay_months: int):
        """Generate explainable reasons for risk and delay with percentage impact"""
        factors = []
        land_pct = float(data.get('land_acquired_pct', 100) or 100)
        clearance = str(data.get('environmental_clearance', 'Approved')).capitalize()
        contractor = str(data.get('contractor_risk', 'Low')).capitalize()
        curr_delay = int(data.get('delay_months', 0) or 0)

        # Land factor
        if land_pct < 95:
            deficit = round(100 - land_pct, 1)
            factors.append({
                "factor": "Land Acquisition Backlog",
                "impact_pct": min(45, int(deficit * 1.5) + 10),
                "detail": f"{deficit}% required land remains pending acquisition."
            })

        # Clearances
        if clearance in ['Pending', 'Conditional', 'Under review']:
            factors.append({
                "factor": "Environmental & Forestry Clearances",
                "impact_pct": 30,
                "detail": "Statutory forestry/environmental or wildlife clearances are still pending approval."
            })

        # Contractor / Vendor
        if contractor in ['High', 'Medium', 'Critical']:
            factors.append({
                "factor": "Contractor / Supply Chain Bottleneck",
                "impact_pct": 25 if contractor in ['High', 'Critical'] else 15,
                "detail": "Contractor mobilization delays or specialized fabrication lag."
            })

        # Cost Escalation
        if overrun_pct > 10:
            factors.append({
                "factor": "Material Inflation & Cost Overrun",
                "impact_pct": min(35, int(overrun_pct * 0.8)),
                "detail": f"Anticipated budget expansion of +{overrun_pct}% above baseline."
            })

        # Existing Schedule Slippage
        if curr_delay > 6:
            factors.append({
                "factor": "Accumulated Timeline Delay",
                "impact_pct": min(30, int(curr_delay * 0.8)),
                "detail": f"Cumulative project milestone delay has reached {curr_delay} months."
            })

        if not factors:
            factors.append({
                "factor": "Standard Project Monitoring",
                "impact_pct": 100,
                "detail": "Project indicators within acceptable MoSPI tolerance limits."
            })
        else:
            total_impact = sum(f["impact_pct"] for f in factors)
            for f in factors:
                f["impact_pct"] = round((f["impact_pct"] / total_impact) * 100)

        return sorted(factors, key=lambda x: x["impact_pct"], reverse=True)

    def _generate_mitigation_recommendations(self, data: dict, risk_score: float, risk_level: str, overrun_pct: float, delay_months: int):
        """Generate targeted, actionable policy and project management recommendations"""
        recs = []
        land_pct = float(data.get('land_acquired_pct', 100) or 100)
        clearance = str(data.get('environmental_clearance', 'Approved')).capitalize()
        contractor = str(data.get('contractor_risk', 'Low')).capitalize()
        curr_delay = int(data.get('delay_months', 0) or 0)
        sector = str(data.get('sector', 'General Infrastructure'))

        # 1. Land Acquisition Mitigation
        if land_pct < 95:
            recs.append({
                "category": "Land Acquisition & RoW",
                "priority": "HIGH" if land_pct < 80 else "MEDIUM",
                "authority": "State Revenue Dept & District Collector",
                "action": "Invoke Section 11/19 fast-track compensation under LARR Act. Establish a dedicated district-level Land Acquisition Task Force to resolve compensation litigations and clear Right-of-Way (RoW).",
                "expected_impact": "Prevents 4-8 months of linear construction halt"
            })

        # 2. Environmental & Statutory Clearances
        if clearance in ['Pending', 'Conditional', 'Under review']:
            recs.append({
                "category": "Environmental & Forestry Clearance",
                "priority": "CRITICAL" if curr_delay > 12 else "HIGH",
                "authority": "MoEFCC & State Forest Department",
                "action": "Escalate through the PARIVESH 2.0 single-window portal for Stage-II statutory tree-felling and wildlife clearance. Deposit required CAMPA compensatory afforestation funds immediately.",
                "expected_impact": "Enables immediate handover of statutory green zones to EPC contractor"
            })

        # 3. Contractor Resource Mobilization & Risk
        if contractor in ['High', 'Critical']:
            recs.append({
                "category": "Contractor Performance & EPC Management",
                "priority": "CRITICAL",
                "authority": "Implementing Agency & Project Directorate",
                "action": "Issue formal contractual cure notice under standard EPC clause. Mandate 3-shift 24/7 working roster, increase heavy equipment deployment, and if needed, carve out delayed civil packages for turnkey subcontracting.",
                "expected_impact": "Recovers 15-20% lost monthly physical pace"
            })
        elif contractor == 'Medium':
            recs.append({
                "category": "Vendor & Supply Chain Monitoring",
                "priority": "MEDIUM",
                "authority": "Superintending Engineer / Resident Engineer",
                "action": "Institute bi-weekly critical path method (CPM) reviews and verify key raw material (cement, steel, ballast) supply chain pipelines.",
                "expected_impact": "Maintains planned milestone velocity"
            })

        # 4. Cost Escalation & Budget Realignment
        if overrun_pct > 15:
            recs.append({
                "category": "Financial Management & Cost Control",
                "priority": "HIGH",
                "authority": "Ministry Financial Advisor & Cabinet Committee on Economic Affairs (CCEA)",
                "action": "Conduct immediate value engineering audit to contain unapproved scope creep. Prepare and submit Revised Cost Estimate (RCE) cabinet note for formal financial re-sanction.",
                "expected_impact": "Protects project liquidity and ensures continuous contractor bill clearances"
            })

        # 5. Milestone Delay / High Risk Escalation
        if risk_level == 'High' or curr_delay > 18:
            recs.append({
                "category": "Inter-Ministerial Governance",
                "priority": "CRITICAL",
                "authority": "Cabinet Secretariat & Project Monitoring Group (PMG)",
                "action": f"Table project on the PMG portal for quarterly review by Cabinet Secretary and State Chief Secretaries. Establish joint inspection committee for {sector} bottlenecks.",
                "expected_impact": "High-level administrative clearance of inter-departmental hurdles"
            })

        # Fallback if in good shape
        if not recs:
            recs.append({
                "category": "Milestone Surveillance",
                "priority": "LOW",
                "authority": "Project Implementing Unit (PIU)",
                "action": "Maintain routine physical-financial monitoring on MoSPI Online Computerized Monitoring System (OCMS). Adhere strictly to quarterly milestone baselines.",
                "expected_impact": "Sustains on-time delivery within sanctioned parameters"
            })

        return recs

# Singleton ML Engine instance
ml_engine = InfrastructureMLEngine()
