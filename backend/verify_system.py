import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

print("=== STEP 1: VERIFYING DATABASE ===")
import database
df = database.get_projects_df()
print(f"Projects loaded: {len(df)}")
assert len(df) == 1775, "Expected 1775 projects"
sectors = df['sector'].unique()
print(f"Distinct sectors ({len(sectors)}):", list(sectors)[:6], "...")
high_risk = int((df['risk_level'] == 'High').sum())
med_risk = int((df['risk_level'] == 'Medium').sum())
low_risk = int((df['risk_level'] == 'Low').sum())
print(f"Risk distribution: High={high_risk}, Medium={med_risk}, Low={low_risk}")
print("Database check: PASSED\n")

print("=== STEP 2: VERIFYING ML & SCIKIT-LEARN ===")
from ml_engine import ml_engine
trained = ml_engine.train_models()
print(f"ML Engine trained: {trained} | Is Trained: {ml_engine.is_trained}")
assert ml_engine.is_trained, "ML Engine should be trained"
print(f"Scikit-Learn Classifier: {type(ml_engine.risk_classifier).__name__}")
print(f"Scikit-Learn Cost Regressor: {type(ml_engine.cost_regressor).__name__}")
print(f"Features ({len(ml_engine.feature_names)}): {ml_engine.feature_names}")
print("Scikit-Learn models check: PASSED\n")

print("=== STEP 3: VERIFYING RISK PREDICTION & RECOMMENDATIONS ===")
test_case = {
    'project_name': 'Test Rail Corridor',
    'sector': 'Railways',
    'original_cost': 5000,
    'expenditure_to_date': 2000,
    'original_duration_months': 48,
    'delay_months': 18,
    'physical_progress': 40,
    'land_acquired_pct': 72,
    'environmental_clearance': 'Pending',
    'contractor_risk': 'High'
}
pred = ml_engine.predict_project_risk(test_case)
print(f"Risk Score: {pred['risk_score']}% | Risk Level: {pred['risk_level']}")
print(f"Predicted Cost: INR {pred['predicted_cost']} Cr (+{pred['cost_overrun_pct']}%)")
print(f"Predicted Delay: {pred['predicted_delay_months']} months")
print(f"Key Reasons ({len(pred['key_reasons'])}):", [r['factor'] for r in pred['key_reasons']])
print(f"Actionable Recommendations ({len(pred['recommendations'])}):")
for rec in pred['recommendations']:
    print(f"  - [{rec['priority']}] {rec['category']} (Authority: {rec['authority']}) -> {rec['expected_impact']}")
assert len(pred['recommendations']) > 0, "Recommendations must be present"
print("Risk prediction & Recommendation check: PASSED\n")

print("=== STEP 4: VERIFYING SECTOR-WISE REPORT DOWNLOAD ===")
import main
rep_rail = main.download_sector_risk_report('Railways')
assert rep_rail.status_code == 200
assert 'MoSPI_Risk_Report_Railways.csv' in rep_rail.headers['content-disposition']
rail_csv_lines = rep_rail.body.decode('utf-8').strip().split('\n')
print(f"Railways CSV rows: {len(rail_csv_lines)} (1 header + {len(rail_csv_lines)-1} projects)")

rep_all = main.download_sector_risk_report('ALL')
assert rep_all.status_code == 200
all_csv_lines = rep_all.body.decode('utf-8').strip().split('\n')
print(f"All Sectors CSV rows: {len(all_csv_lines)} (1 header + {len(all_csv_lines)-1} projects)")
print("Sector-wise Risk Report download check: PASSED\n")

print("=== STEP 5: VERIFYING LLM & ASSISTANT ===")
import chatbot_engine
res_query1 = chatbot_engine.query_ai_chatbot('recommendation sollu')
assert 'Mitigation' in res_query1 or 'Recommendations' in res_query1
print("Chatbot query 1 (recommendation sollu): OK")

res_query2 = chatbot_engine.query_ai_chatbot('sector wise risk report download')
assert 'Download' in res_query2 or 'api/reports/sector-wise/download' in res_query2
print("Chatbot query 2 (sector report download): OK")

res_query3 = chatbot_engine.query_ai_chatbot('project database correct a irukaa')
assert 'Verification Status' in res_query3 or 'Synchronized' in res_query3
print("Chatbot query 3 (database correct-aa irukaa): OK")
print("LLM / Chatbot Intelligence check: PASSED\n")

print("=== ALL 6 CHECKS PASSED PERFECTLY! ===")
