We are transitioning from a standalone Machine Component Mapping Workbench into a production-grade Industrial Digital Twin Platform for Injection Molding Machine predictive maintenance.

IMPORTANT CONTEXT

The project already contains:

* Injection molding machine 3D model
* Component mapping workbench
* component-map.detailed.json
* Existing predictive maintenance dashboard
* Health scoring system
* RUL calculations
* Cloudflare Tunnel deployment workflow

The component mapping workbench is no longer a separate application.

It must become a native module within the Digital Twin Platform.

The existing component-map.detailed.json should be treated as the source of truth for subsystem-to-mesh relationships.

The platform must consume this mapping automatically.

====================================================================
PRIMARY GOAL
============

Create an enterprise-grade industrial monitoring experience suitable for presentation to manufacturing clients.

The application should feel comparable to modern industrial platforms used by:

* Siemens
* Bosch
* Schneider Electric
* Rockwell Automation
* GE Digital
* ABB
* PTC ThingWorx

The design objective is:

"Professional industrial software"

NOT:

"Student dashboard"

====================================================================
PHASE 0
ARCHITECTURE REVIEW
===================

Before implementation:

Generate:

IMPLEMENTATION_PLAN.md

Generate:

TASKS.md

Generate:

ARCHITECTURE.md

Generate:

UI_STRATEGY.md

Generate:

DECISIONS.md

Generate:

RISK_REGISTER.md

Generate:

DEPLOYMENT.md

The implementation plan must be detailed.

Every task must be traceable.

No implementation should begin before planning artifacts are generated.

====================================================================
SYSTEM ARCHITECTURE
===================

Create a modular architecture.

Modules:

1. Digital Twin Viewer
2. Component Mapping Engine
3. Component Health Engine
4. RUL Engine
5. Sensor Visualization Engine
6. Alert Engine
7. Analytics Engine
8. Deployment Module
9. Collaboration Module

The architecture must support future expansion without refactoring.

====================================================================
3D DIGITAL TWIN VIEWER
======================

The 3D model should become a primary experience.

Current dashboard allocation is too small.

Redesign layout.

Viewer should occupy a major portion of the screen.

Possible layouts:

* Split View
* Twin Focus Layout
* Command Center Layout

Choose the best industry-standard approach.

The viewer should feel like a digital twin environment.

Requirements:

* Orbit
* Pan
* Zoom
* Reset camera
* Fit model
* Focus component
* Smooth transitions
* Cinematic camera movements
* Persistent state

====================================================================
COMPONENT INTERACTION
=====================

The component-map.detailed.json must be used.

When a subsystem is selected:

Hydraulic
ScrewCheckRing
Drive
Heaters
Mold

The corresponding meshes must highlight automatically.

Capabilities:

* Hover subsystem
* Highlight subsystem
* Click subsystem
* Focus camera
* Open subsystem details

Subsystems should have visual identity.

Example:

Hydraulic = blue
ScrewCheckRing = orange
Drive = green
Heaters = yellow
Mold = purple

====================================================================
COMPONENT HEALTH PANEL
======================

Current health card design should evolve into a subsystem detail panel.

Example:

Hydraulic selected

Display:

Health Score
RUL
Current Status
Failure Probability
Maintenance Recommendation
Sensor Summary
Trend Direction

The selected component becomes the active context of the dashboard.

Every graph should update accordingly.

====================================================================
INTELLIGENT TOOLTIPS
====================

This is a major requirement.

Whenever the user hovers ANYTHING:

Provide context.

Examples:

Health Score:

Show:

* What score means
* Why score is high or low
* Expected behavior
* Interpretation

Graph Point:

Show:

* Exact value
* Timestamp
* Trend
* Meaning
* Risk interpretation

Sensor Reading:

Show:

* Current value
* Normal range
* Warning range
* Critical range
* Operational meaning

The platform should explain itself.

A non-technical user should understand the dashboard.

Every visualization should answer:

"What am I seeing?"
"Is it good or bad?"
"What should I do?"

====================================================================
GRAPH SYSTEM
============

Upgrade graphs.

Requirements:

* Crosshair
* Hover values
* Contextual explanations
* Threshold overlays
* Warning regions
* Critical regions
* Forecast regions
* Predicted failure markers

Every graph should feel enterprise-grade.

====================================================================
DIGITAL TWIN INSPECTION MODE
============================

The original workbench capabilities must remain available.

Create:

Inspection Mode

Features:

* Mesh selection
* Hierarchy explorer
* Isolation mode
* Wireframe mode
* Transparency mode
* Search
* Mapping editor

This should be accessible from the production dashboard.

Power users should be able to inspect internals without leaving the platform.

====================================================================
COLLABORATIVE REVIEW MODE
=========================

Support remote review sessions.

Workflow:

Developer machine
→ Repository
→ DGX
→ Cloudflare Tunnel

The application must support:

* Multiple remote viewers
* Shared review sessions
* Mapping validation sessions

Assume developers and domain experts may review the same machine remotely.

====================================================================
DEPLOYMENT WORKFLOW
===================

Very important.

The DGX deployment must not require retraining.

The application must be deterministic.

All outputs should be persisted.

Store:

* component mappings
* assignments
* UI settings
* thresholds
* configuration

in files or database.

No manual recreation should be required after cloning.

Developer workflow:

Laptop
→ Validate
→ Commit
→ Push

DGX

→ Pull
→ Install
→ Start

System should work immediately.

No repeated setup process.

No repeated mapping process.

No repeated training process.

====================================================================
VISUAL DESIGN
=============

The platform should look premium.

Use industry best practices.

Prioritize:

Information density
Clarity
Professionalism
Readability

Avoid:

Consumer-style dashboards
Gaming aesthetics
Unnecessary animations

Use animation only when it improves understanding.

====================================================================
PERFORMANCE
===========

The platform must remain responsive.

Requirements:

* Smooth camera movement
* Smooth highlighting
* Fast filtering
* Fast subsystem selection

Target:

60 FPS interaction.

====================================================================
IMPLEMENTATION APPROACH
=======================

Do not attempt everything at once.

Create:

Phase 1
Phase 2
Phase 3
Phase 4
Phase 5

Each phase must have:

Objectives
Tasks
Acceptance Criteria
Manual Test Cases
Deployment Validation

Update TASKS.md continuously.

Mark progress throughout implementation.

Maintain a working application after every phase.

The application should always remain deployable.

Never break working functionality while introducing new features.
