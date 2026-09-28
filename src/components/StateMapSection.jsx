import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";

import "./StateMapSection.css";

const INDIA_GEO_URL = "/india-states.geojson";

/* =========================================================
   PASTEL COLORS
   ========================================================= */

const PASTEL_COLORS = [
  "#DCEEFF",
  "#E8F5E9",
  "#FFF3D6",
  "#FCE4EC",
  "#EDE7F6",
  "#E0F7FA",
  "#FFF8E1",
  "#E8EAF6",
  "#F1F8E9",
  "#FBE9E7",
  "#E3F2FD",
  "#F3E5F5",
  "#E0F2F1",
  "#FFFDE7",
  "#F9FBE7",
  "#ECEFF1",
  "#FFE5D9",
  "#E1F5FE",
  "#F1F8E9",
  "#FFF3E0",
  "#EDE7F6",
  "#E0F7FA",
  "#FFF8E1",
  "#E8F5E9",
  "#F3E5F5",
  "#E3F2FD",
  "#FBE9E7",
  "#E0F2F1",
  "#FFFDE7",
  "#F1F8E9",
  "#ECEFF1",
  "#DCEEFF",
  "#FCE4EC",
  "#E8EAF6",
  "#FFF3D6",
];

/* =========================================================
   STATE LABEL POSITIONS
   ========================================================= */

const STATE_LABELS = {
  "Jammu and Kashmir": [76.8, 33.2],
  "Jammu & Kashmir": [76.8, 33.2],
  Ladakh: [77.8, 34.1],

  "Himachal Pradesh": [77.3, 31.7],
  Punjab: [75.4, 31.0],
  Uttarakhand: [79.2, 30.1],
  Haryana: [76.0, 29.4],
  Delhi: [77.1, 28.6],

  Rajasthan: [73.9, 27.0],
  "Uttar Pradesh": [80.8, 26.8],

  Sikkim: [88.5, 27.5],
  "Arunachal Pradesh": [94.5, 28.2],
  Assam: [92.8, 26.2],
  Nagaland: [94.1, 26.0],
  Meghalaya: [91.3, 25.5],
  Manipur: [93.9, 24.7],
  Mizoram: [92.8, 23.4],
  Tripura: [91.5, 23.8],

  Bihar: [85.3, 25.7],
  Jharkhand: [85.7, 23.6],
  "West Bengal": [87.9, 23.2],
  Odisha: [84.4, 20.5],

  Gujarat: [71.5, 22.7],
  "Madhya Pradesh": [78.4, 23.7],
  Chhattisgarh: [82.0, 21.3],

  Maharashtra: [75.5, 19.3],
  Goa: [74.0, 15.4],

  Telangana: [79.3, 18.1],
  Karnataka: [76.0, 15.3],
  "Andhra Pradesh": [79.7, 15.9],

  "Tamil Nadu": [78.5, 10.8],
  Kerala: [76.4, 10.3],

  Puducherry: [79.8, 11.9],

  "Andaman and Nicobar Islands": [92.8, 11.5],
  "Andaman & Nicobar Islands": [92.8, 11.5],

  Lakshadweep: [72.6, 10.8],
  Chandigarh: [76.8, 30.7],
};

/* =========================================================
   NORMALIZE STATE NAME
   ========================================================= */

const normalizeStateName = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSectorName = (name = "") => ({
  "Roads & Highways": "Road Transport & Highways",
  Roads: "Road Transport & Highways",
  Power: "Electricity Generation",
  Aviation: "Aviation & Aviation Infrastructure",
  "Urban Transport": "Urban Public Transport",
}[String(name).trim()] || String(name).trim());

/* =========================================================
   GET STATE NAME FROM GEOJSON
   ========================================================= */

const getGeoStateName = (geo) => {
  const props = geo?.properties || {};

  const possibleNames = [
    props.ST_NM,
    props.ST_NAME,
    props.STATE_NAME,
    props.NAME_1,
    props.name,
    props.NAME,
    props.state,
    props.State,
    props.state_name,
    props.st_nm,
    props.st_name,
  ];

  const found = possibleNames.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  );

  return found ? String(found).trim() : "Unknown State";
};

/* =========================================================
   DISPLAY NAME
   ========================================================= */

const displayStateName = (name) => {
  const normalized = normalizeStateName(name);

  const aliases = {
    "jammu and kashmir": "Jammu and Kashmir",
    "jammu kashmir": "Jammu and Kashmir",

    "andaman and nicobar":
      "Andaman and Nicobar Islands",

    "andaman and nicobar islands":
      "Andaman and Nicobar Islands",

    "dadra and nagar haveli and daman and diu":
      "Dadra and Nagar Haveli and Daman and Diu",

    "nct of delhi": "Delhi",

    orissa: "Odisha",

    pondicherry: "Puducherry",

    uttaranchal: "Uttarakhand",
    uttarakhand: "Uttarakhand",
  };

  return aliases[normalized] || name;
};

/* =========================================================
   STATE DATA
   Existing fallback data retained exactly
   ========================================================= */

const STATE_DATA = {
  "Madhya Pradesh": {
    projectCount: 99,
    originalCost: "₹ 1,74,856",
    revisedCost: "₹ 1,89,885.04",
    expenditure: "₹ 77,084.54",
    completed: 3,
    newlyAdded: 1,
    sectors: ["Roads & Highways", "Coal", "Railways"],
    ministries: [
      "Ministry of Road Transport & Highways",
      "Ministry of Coal",
      "Ministry of Railways",
    ],
  },

  Chhattisgarh: {
    projectCount: 99,
    originalCost: "₹ 1,74,856",
    revisedCost: "₹ 1,89,885.04",
    expenditure: "₹ 77,084.54",
    completed: 3,
    newlyAdded: 1,
    sectors: ["Roads & Highways", "Coal", "Railways"],
    ministries: [
      "Ministry of Road Transport & Highways",
      "Ministry of Coal",
      "Ministry of Railways",
    ],
  },

  Maharashtra: {
    projectCount: 124,
    originalCost: "₹ 2,41,520",
    revisedCost: "₹ 2,58,430",
    expenditure: "₹ 1,12,640",
    completed: 7,
    newlyAdded: 2,
    sectors: ["Railways", "Roads & Highways", "Power"],
    ministries: [
      "Ministry of Railways",
      "Ministry of Road Transport & Highways",
      "Ministry of Power",
    ],
  },

  "Uttar Pradesh": {
    projectCount: 138,
    originalCost: "₹ 2,86,420",
    revisedCost: "₹ 3,01,840",
    expenditure: "₹ 1,35,250",
    completed: 8,
    newlyAdded: 3,
    sectors: ["Railways", "Roads & Highways", "Energy"],
    ministries: [
      "Ministry of Railways",
      "Ministry of Road Transport & Highways",
      "Ministry of Power",
    ],
  },

  "Tamil Nadu": {
    projectCount: 116,
    originalCost: "₹ 2,14,860",
    revisedCost: "₹ 2,28,540",
    expenditure: "₹ 98,420",
    completed: 6,
    newlyAdded: 2,
    sectors: ["Roads & Highways", "Ports", "Railways"],
    ministries: [
      "Ministry of Road Transport & Highways",
      "Ministry of Ports",
      "Ministry of Railways",
    ],
  },

  Gujarat: {
    projectCount: 108,
    originalCost: "₹ 2,06,780",
    revisedCost: "₹ 2,17,630",
    expenditure: "₹ 94,180",
    completed: 5,
    newlyAdded: 2,
    sectors: ["Ports", "Petroleum", "Roads & Highways"],
    ministries: [
      "Ministry of Ports",
      "Ministry of Petroleum",
      "Ministry of Road Transport & Highways",
    ],
  },

  Rajasthan: {
    projectCount: 91,
    originalCost: "₹ 1,65,430",
    revisedCost: "₹ 1,77,280",
    expenditure: "₹ 71,840",
    completed: 4,
    newlyAdded: 1,
    sectors: ["Roads & Highways", "Power", "Mining"],
    ministries: [
      "Ministry of Road Transport & Highways",
      "Ministry of Power",
      "Ministry of Coal",
    ],
  },

  Karnataka: {
    projectCount: 104,
    originalCost: "₹ 1,92,680",
    revisedCost: "₹ 2,04,520",
    expenditure: "₹ 88,420",
    completed: 5,
    newlyAdded: 2,
    sectors: ["Railways", "Roads & Highways", "Power"],
    ministries: [
      "Ministry of Railways",
      "Ministry of Road Transport & Highways",
      "Ministry of Power",
    ],
  },

  Odisha: {
    projectCount: 87,
    originalCost: "₹ 1,58,740",
    revisedCost: "₹ 1,67,390",
    expenditure: "₹ 69,530",
    completed: 4,
    newlyAdded: 1,
    sectors: ["Coal", "Railways", "Steel"],
    ministries: [
      "Ministry of Coal",
      "Ministry of Railways",
      "Ministry of Steel",
    ],
  },
};

/* =========================================================
   GET STATE INFO
   IMPORTANT:
   stateWiseData is passed into this function.
   This fixes the previous ReferenceError.
   ========================================================= */

const getStateInfo = (stateName, liveStateData = {}) => {
  const cleanName = displayStateName(stateName);
  const normalizedName = normalizeStateName(cleanName);

  const liveState = Object.entries(liveStateData).find(
    ([state]) =>
      normalizeStateName(state) === normalizedName
  );

  if (liveState) {
    return liveState[1];
  }

  return (
    STATE_DATA[cleanName] || {
      projectCount: 0,
      originalCost: "₹ 0",
      revisedCost: "₹ 0",
      expenditure: "₹ 0",
      completed: 0,
      newlyAdded: 0,
      sectors: ["Infrastructure"],
      ministries: ["Central Monitoring"],
    }
  );
};

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function StateMapSection() {
  const [selectedState, setSelectedState] =
    useState("Chhattisgarh");

  const [hoveredState, setHoveredState] =
    useState(null);

  const [position, setPosition] = useState({
    coordinates: [82, 22],
    zoom: 1.35,
  });

  /* =======================================================
     LIVE PROJECT DATA
     ======================================================= */

  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/projects`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch projects: ${response.status}`
          );
        }

        const data = await response.json();

        console.log(
          "Projects received from API:",
          data.projects?.length
        );

        setProjects(data.projects || []);
      } catch (error) {
        console.error("Map API Error:", error);
      }
    };

    fetchProjects();
  }, []);

  /* =======================================================
     STATE-WISE LIVE DATA
     ======================================================= */

  const stateWiseData = useMemo(() => {
    const result = {};

    projects.forEach((project) => {
      if (!project || !project.state) return;

      const state = displayStateName(
        String(project.state).trim()
      );

      if (!result[state]) {
        result[state] = {
          projectCount: 0,
          originalCost: 0,
          revisedCost: 0,
          expenditure: 0,
          completed: 0,
          newlyAdded: 0,
          sectors: {},
          ministries: {},
        };
      }

      const item = result[state];

/* =====================================================
   PROJECT COUNT
   ===================================================== */

item.projectCount += 1;


/* =====================================================
   ORIGINAL COST
   ===================================================== */

const originalCostValue =
  project.original_cost ?? 0;

const parsedOriginalCost = Number(
  String(originalCostValue)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim()
);

if (!isNaN(parsedOriginalCost)) {
  item.originalCost += parsedOriginalCost;
}


/* =====================================================
   REVISED COST
   ===================================================== */

const revisedCostValue =
  project.revised_cost ?? 0;

const parsedRevisedCost = Number(
  String(revisedCostValue)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim()
);

if (!isNaN(parsedRevisedCost)) {
  item.revisedCost += parsedRevisedCost;
}


/* =====================================================
   EXPENDITURE
   ===================================================== */

const expenditureValue =
  project.expenditure_to_date ??
  project.expenditure ??
  project.expenditure_cumulative ??
  project.expenditure_cummulative ??
  project.cumulative_expenditure ??
  0;

const parsedExpenditure = Number(
  String(expenditureValue)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim()
);

if (!isNaN(parsedExpenditure)) {
  item.expenditure += parsedExpenditure;
}


/* =====================================================
   COMPLETED PROJECTS
   ===================================================== */

const progressValue =
  project.physical_progress ??
  project.physicalProgress ??
  project.progress ??
  project.completion_percentage ??
  project.completion_percent ??
  0;

const parsedProgress = parseFloat(
  String(progressValue)
    .replace("%", "")
    .trim()
);

if (
  !isNaN(parsedProgress) &&
  parsedProgress >= 100
) {
  item.completed += 1;
}
item.completed += Number(project.completed_during_month) || 0;
item.newlyAdded += Number(project.newly_added) || 0;


/* =====================================================
   SECTOR
   ===================================================== */

if (project.sector) {
  const sector = normalizeSectorName(project.sector);

  if (sector) {
    item.sectors[sector] =
      (item.sectors[sector] || 0) + 1;
  }
}


/* =====================================================
   MINISTRY
   ===================================================== */

if (project.ministry) {
  const ministry = String(
    project.ministry
  ).trim();

  if (ministry) {
    item.ministries[ministry] =
      (item.ministries[ministry] || 0) + 1;
  }
}
    });

    /* =====================================================
       CONVERT DATA TO EXISTING UI FORMAT
       ===================================================== */

    Object.keys(result).forEach((state) => {
      const item = result[state];

      const topSectors = Object.entries(
        item.sectors
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const topMinistries = Object.entries(
        item.ministries
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      result[state] = {
        projectCount: item.projectCount,

        originalCost:
          "₹ " +
          item.originalCost.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          ),

        revisedCost:
          "₹ " +
          item.revisedCost.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          ),

        expenditure:
          "₹ " +
          item.expenditure.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          ),

        completed: item.completed,

        newlyAdded: 0,

        sectors:
          topSectors.length > 0
            ? topSectors
            : ["Infrastructure"],

        ministries:
          topMinistries.length > 0
            ? topMinistries
            : ["Central Monitoring"],
      };
    });

    return result;
  }, [projects]);

  /* =======================================================
     SELECTED STATE INFO
     ======================================================= */

  const selectedInfo = useMemo(
    () =>
      getStateInfo(
        selectedState,
        stateWiseData
      ),
    [selectedState, stateWiseData]
  );

  /* =======================================================
     QUICK STATES
     ======================================================= */

  const quickStates = [
    "Madhya Pradesh",
    "Maharashtra",
    "Uttar Pradesh",
    "Tamil Nadu",
    "Gujarat",
    "Rajasthan",
    "Karnataka",
    "Odisha",
  ];

  /* =======================================================
     MAP CONTROLS
     ======================================================= */

  const zoomIn = () => {
    setPosition((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.35, 4),
    }));
  };

  const zoomOut = () => {
    setPosition((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.35, 0.9),
    }));
  };

  const resetMap = () => {
    setPosition({
      coordinates: [82, 22],
      zoom: 1.35,
    });
  };

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <section className="state-map-section">

      {/* ===================================================
          HEADER
          =================================================== */}

      <div className="state-map-page-header">

        <div>
          <div className="page-title-row">

            <h1>
              State-wise Infrastructure Governance
            </h1>

            <span className="as-of-date">
              as of July, 2026
            </span>

          </div>

          <p>
            Real-time spatial mapping with Sector footprints,
            Ministry sanctions, and AI Risk Indices across Indian States.
          </p>

        </div>

        <label className="state-search-box" htmlFor="state-selector">
          <span className="search-icon">⌕</span>
          <select
            id="state-selector"
            value={selectedState}
            onChange={(event) => setSelectedState(displayStateName(event.target.value))}
            aria-label="Select state"
          >
            {Object.keys(stateWiseData).sort().map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <span className="search-arrow">⌄</span>
        </label>

      </div>

      {/* ===================================================
          MAIN LAYOUT
          =================================================== */}

      <div className="state-map-layout">

        {/* =================================================
            LEFT SIDE
            ================================================= */}

        <div className="state-details-panel">

          <div className="state-card-header">

            <div>

              <h2>
                {selectedState}
              </h2>

              <div className="state-location">
                <span>⌖</span>
                Central Monitored Territory
              </div>

            </div>

            <div className="live-status-dot"></div>

          </div>

          {/* INFO */}

          <div className="state-info-content">

            <div className="info-group">

              <div className="info-label">
                <span>▧</span>
                KEY SECTORS:
              </div>

              <div className="tag-row">

                {selectedInfo.sectors.map(
                  (sector) => (
                    <span
                      className="sector-tag"
                      key={sector}
                    >
                      {sector}
                    </span>
                  )
                )}

              </div>

            </div>

            <div className="info-group">

              <div className="info-label">
                <span>▥</span>
                LINE MINISTRIES:
              </div>

              <div className="tag-row">

                {selectedInfo.ministries.map(
                  (ministry) => (
                    <span
                      className="ministry-tag"
                      key={ministry}
                    >
                      {ministry}
                    </span>
                  )
                )}

              </div>

            </div>

          </div>

          {/* METRICS */}

          <div className="metrics-grid">

            <MetricCard
              icon="▦"
              label="Project Count (No.)"
              value={selectedInfo.projectCount}
            />

            <MetricCard
              icon="◎"
              label="Original Cost (in Cr.)"
              value={selectedInfo.originalCost}
            />

            <MetricCard
              icon="◉"
              label="Latest Revised Cost (in Cr.)"
              value={selectedInfo.revisedCost}
            />

            <MetricCard
              icon="↗"
              label="Expenditure (Cumm.) (in Cr.)"
              value={selectedInfo.expenditure}
            />

            <MetricCard
              icon="▣"
              label="Completed During month (No.)"
              value={selectedInfo.completed}
            />

            <MetricCard
              icon="▤"
              label="Newly Added (No.)"
              value={selectedInfo.newlyAdded}
            />

          </div>

          {/* QUICK STATES */}

          <div className="quick-state-section">

            <div className="info-label quick-title">
              <span>⌖</span>
              QUICK SELECT STATE:
            </div>

            <div className="quick-state-list">

              {quickStates.map((state) => (
                <button
                  key={state}
                  className={
                    normalizeStateName(
                      selectedState
                    ) ===
                    normalizeStateName(state)
                      ? "quick-state active"
                      : "quick-state"
                  }
                  onClick={() =>
                    setSelectedState(state)
                  }
                >
                  {state}
                </button>
              ))}

            </div>

          </div>

        </div>

        {/* =================================================
            RIGHT MAP
            ================================================= */}

        <div className="india-map-panel">

          <div className="map-header">

            <div>

              <div className="map-eyebrow">
                NATIONAL INFRASTRUCTURE MAP
              </div>

              <h2>
                India Infrastructure Footprint
              </h2>

            </div>

            <div className="live-data-pill">
              <span></span>
              LIVE DATA
            </div>

          </div>

          {/* =================================================
              MAP
              ================================================= */}

          <div className="map-canvas">

            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 680,
                center: [82, 22],
              }}
              width={900}
              height={620}
              style={{
                width: "100%",
                height: "100%",
              }}
            >

              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                minZoom={0.9}
                maxZoom={4}
                onMoveEnd={({
                  coordinates,
                  zoom,
                }) => {
                  setPosition({
                    coordinates,
                    zoom,
                  });
                }}
              >

                {/* =========================================
                    INDIA STATES
                    ========================================= */}

                <Geographies
                  geography={INDIA_GEO_URL}
                >

                  {({
                    geographies,
                  }) =>
                    geographies.map(
                      (geo, index) => {

                        const rawName =
                          getGeoStateName(geo);

                        const stateName =
                          displayStateName(
                            rawName
                          );

                        const isSelected =
                          normalizeStateName(
                            stateName
                          ) ===
                          normalizeStateName(
                            selectedState
                          );

                        const stateColor =
                          isSelected
                            ? "#1677D2"
                            : PASTEL_COLORS[
                                index %
                                  PASTEL_COLORS.length
                              ];

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            className="india-state"

                            style={{
                              "--state-fill":
                                stateColor,

                              "--state-hover":
                                isSelected
                                  ? "#0D63B5"
                                  : "#B9DEFA",
                            }}

                            onClick={() => {
                              setSelectedState(
                                stateName
                              );
                            }}

                            onMouseEnter={() => {
                              setHoveredState(
                                stateName
                              );
                            }}

                            onMouseLeave={() => {
                              setHoveredState(null);
                            }}
                          />
                        );
                      }
                    )
                  }

                </Geographies>

                {/* =========================================
                    STATE LABELS
                    ========================================= */}

                {Object.entries(
                  STATE_LABELS
                ).map(
                  ([stateName, coordinates]) => {

                    const isSelected =
                      normalizeStateName(
                        selectedState
                      ) ===
                      normalizeStateName(
                        stateName
                      );

                    return (
                      <Marker
                        key={stateName}
                        coordinates={
                          coordinates
                        }
                      >

                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={
                            isSelected
                              ? "state-map-label selected"
                              : "state-map-label"
                          }
                        >
                          {stateName}
                        </text>

                      </Marker>
                    );
                  }
                )}

              </ZoomableGroup>

            </ComposableMap>

            {/* =================================================
                CONTROLS
                ================================================= */}

            <div className="map-controls">

              <button
                className="map-control-button"
                onClick={resetMap}
                title="Reset map"
              >
                ↻
              </button>

              <button
                className="map-control-button"
                onClick={zoomIn}
                title="Zoom in"
              >
                +
              </button>

              <button
                className="map-control-button"
                onClick={zoomOut}
                title="Zoom out"
              >
                −
              </button>

            </div>

            {/* =================================================
                COMPASS
                ================================================= */}

            <div className="map-compass">

              <span className="north">
                N
              </span>

              <span className="east">
                E
              </span>

              <span className="south">
                S
              </span>

              <span className="west">
                W
              </span>

              <div className="compass-arrow">
                ◆
              </div>

            </div>

            {/* =================================================
                HOVER CARD
                ================================================= */}

            {hoveredState && (
              <div className="map-hover-card">

                <div className="hover-card-title">
                  {hoveredState}
                </div>

                <div className="hover-card-divider"></div>

                <div className="hover-stat">

                  <span>
                    Projects
                  </span>

                  <strong>
                    {
                      getStateInfo(
                        hoveredState,
                        stateWiseData
                      ).projectCount
                    }
                  </strong>

                </div>

                <div className="hover-stat">

                  <span>
                    Expenditure
                  </span>

                  <strong>
                    {
                      getStateInfo(
                        hoveredState,
                        stateWiseData
                      ).expenditure
                    }
                  </strong>

                </div>

                <div className="hover-stat">

                  <span>
                    Completed
                  </span>

                  <strong>
                    {
                      getStateInfo(
                        hoveredState,
                        stateWiseData
                      ).completed
                    }
                  </strong>

                </div>

              </div>
            )}

            {/* =================================================
                LEGEND
                ================================================= */}

            <div className="risk-legend">

              <div className="legend-title">
                AI RISK INDEX
              </div>

              <div className="legend-row">
                <span className="legend-dot low"></span>
                <span>Low</span>
              </div>

              <div className="legend-row">
                <span className="legend-dot medium"></span>
                <span>Medium</span>
              </div>

              <div className="legend-row">
                <span className="legend-dot high"></span>
                <span>High</span>
              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   METRIC CARD
   ========================================================= */

function MetricCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="metric-card">

      <div className="metric-icon">
        {icon}
      </div>

      <div className="metric-content">

        <div className="metric-label">
          {label}
        </div>

        <div className="metric-value">
          {value}
        </div>

      </div>

    </div>
  );
}