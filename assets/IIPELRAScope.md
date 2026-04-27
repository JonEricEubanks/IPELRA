 
Project Scope Intake Form
This form gathers the essential details about a project to ensure clear objectives, expectations, and resource alignment.
•	CSM is responsible for completing Sections 1-3 and submitting it to the SDM via the Virtual Assistant. 
•	If additional details are needed, a follow-up meeting will be scheduled.
1: General Information
1.	Project Name: IPELRA Conference App Development

2.	Client: IPELRA

3.	Requester Contact Information: 
a.	Name: Angie Miller
b.	Email: Click or tap here to enter text.
c.	Phone: Click or tap here to enter text.

4.	Date of Submission: 4/1/2026

5.	Desired Project Start Date: 4/1/2026

6.	Target Completion Date: 5/31/2026
2: Objectives & Success Criteria
1.	What is the primary goal of this project? (Check all that apply) 
☐ Process improvement 
☐ Data analysis/reporting 
☐ System implementation 
☐ Compliance requirement 
☒ Other (please specify): App Development	

2.	Describe the problem or opportunity this project is addressing:
MGP has been asked to build an app to support the IPELRA Conference.

3.	What are the key success criteria for this project? (e.g., specific deliverables, efficiency improvements, compliance adherence)
Core Functions
•	Mobile friendly web link vs full app download needed
•	List of sponsor stops that attendees can complete
•	Each stop is unlocked by either:
o	Scanning a QR code at the sponsor table
OR
o	Completing a simple one question prompt
•	App tracks attendee progress/points as they complete stops
•	When finished, attendee sees a “Completed Passport” confirmation for prize entry
•	Easy for IPELRA to add/update sponsors, logos, and prompts/tagline
• Each sponsor gets a unique QR code
• Display sponsor name, logo, and brief tagline in the app
• Option to include a short prompt (optional)
• Basic usage metrics (ex: number of scans/check ins)

Light Gamification
• Points for each completed sponsor stop
• Simple progress bar or checklist
• Optional “bonus stops” for higher tier sponsors

3: Scope & Deliverables
1.	What specific deliverables are expected from this project? (Check all that apply) 
☐ Report/Analysis 
☐ Dashboard/Visualization 
☐ Software Implementation 
☐ Training/Documentation 
☒ Other: App Development

2.	What systems, tools, or datasets will be involved? 
Click or tap here to enter text.

3.	Internal databases (please specify): 
Click or tap here to enter text.

4.	External vendor platforms (please specify): 
Click or tap here to enter text.

5.	Manual processes requiring automation: 
Click or tap here to enter text.

6.	Other:  
Click or tap here to enter text.

7.	Are there any constraints or limitations? (e.g., data access, resource availability, legal restrictions)
Click or tap here to enter text.
4: Resource Allocation & Dependencies 
1.	Estimated analyst hours needed: Click or tap here to enter text.

2.	Will this project require coordination with external vendors or teams? 
☐ Yes (please specify): Click or tap here to enter text.
☐ No 

3.	Are there existing projects that may impact this initiative? 
☐ Yes (please specify): Click or tap here to enter text.
☐ No 
5: Risk & Approval 
1.	Potential risks associated with this project: 
☐ Data security concerns 
☐ Compliance/legal risks 
☐ Resource limitations 
☐ Unclear requirements 
☐ Other: Click or tap here to enter text.
6: User Stories
IPELRA needs a simple, mobile-friendly “conference passport” experience because attendees currently lack an easy way to complete sponsor stops and confirm prize eligibility. We will deliver a web-accessible passport that lets attendees unlock sponsor stops (via QR scan or a quick prompt), tracks progress/points, and confirms completion—while enabling IPELRA to maintain sponsor content and view basic participation metrics.
1.	Attendee – Sponsor Stops
 As an attendee, I want to see a list of sponsor stops I can complete, so that I can participate in the conference passport activity.
2.	Attendee – Unlock Stop (QR or Prompt)
 As an attendee, I want to unlock a sponsor stop by either scanning a QR code at the sponsor table or completing a one-question prompt, so that I can complete stops even if one method isn’t available.
3.	Attendee – Progress & Points
 As an attendee, I want the passport to track my completed stops and points with a simple progress indicator, so that I know how close I am to finishing.
4.	Attendee – Completion Confirmation
 As an attendee, I want to receive a “Completed Passport” confirmation when I finish the required stops, so that I can confirm I’m eligible for prize entry.
5.	IPELRA Admin – Manage Sponsors & Content
 As an IPELRA admin, I want to add/update sponsors (name, logo, tagline, optional prompt/bonus designation) and generate a unique QR code per sponsor, so that the passport stays current and easy to maintain.
6.	IPELRA Admin – Basic Metrics
 As an IPELRA admin, I want to view basic usage metrics (e.g., number of scans/check-ins per sponsor), so that I can understand participation and sponsor engagement.

7: Requirements
FUNCTIONAL REQUIREMENTS
•	FR 01: The solution must be accessible via a mobile-friendly web link (no full app download required).
•	FR 02: The solution must display a list of sponsor stops available for attendees to complete.
•	FR 03: Each sponsor stop must be completable by either (a) QR code scan at the sponsor table or (b) completing a single-question prompt.
•	FR 04: The solution must track attendee completion status per sponsor stop and maintain a points total based on completed stops.
•	FR 05: The attendee experience must include a simple progress indicator (e.g., progress bar and/or checklist).
•	FR 06: Upon completing the defined requirements, the solution must display a “Completed Passport” confirmation for prize entry verification.
•	FR 07: Admin users must be able to add/update sponsors including sponsor name, logo, brief tagline, and optional prompt.
•	FR 08: The solution must generate and associate a unique QR code per sponsor for use at sponsor tables.
•	FR 09: The solution must support optional bonus stops for higher-tier sponsors (i.e., a designated set of bonus stops that can award additional points and/or count separately).
•	FR 10: The solution must provide basic usage metrics such as number of scans/check-ins per sponsor stop.
•	FR 11: Branding reflects IPELRA conference branding standards.
TECHNICAL REQUIREMENTS
•	TR 01: The attendee experience must function on mobile devices via a web link and be responsive for common mobile screen sizes.
•	TR 02: The solution must support QR code scanning from a mobile device (camera-enabled scanning within the experience or an equivalent scanning workflow).
•	TR 03: Sponsor data (name/logo/tagline/prompt/bonus designation) must be stored in a maintainable data source that supports admin updates without redevelopment.
•	TR 04: Attendee progress and points must be stored in a way that supports: completed-stop validation, completion confirmation, and metrics reporting.
•	TR 05: Admin access must be restricted to authorized IPELRA users for sponsor/content updates and metrics viewing.
•	TR 06: The solution must produce/export sponsor QR codes in a format suitable for printing/display at tables.

8: Acceptance Criteria
•	AC 01: GIVEN an attendee opens the passport link on a phone WHEN the page loads THEN the interface displays correctly in a mobile-friendly layout and provides access to sponsor stops.
•	AC 02: GIVEN sponsor stops exist WHEN an attendee views the stops list THEN each stop displays the sponsor name, logo, and tagline (where provided).
•	AC 03: GIVEN an attendee selects a sponsor stop WHEN they choose the QR option and scan the sponsor’s QR code THEN the stop is marked completed and points are added per the configured rules.
•	AC 04: GIVEN an attendee selects a sponsor stop WHEN they choose the prompt option and submit a response to the single-question prompt THEN the stop is marked completed and points are added per the configured rules.
•	AC 05: GIVEN an attendee completes one or more stops WHEN they return to the main passport view THEN the progress indicator reflects the current completion count/status and current points total.
•	AC 06: GIVEN an attendee has completed the defined completion threshold WHEN they view the passport status THEN the solution displays a “Completed Passport” confirmation.
•	AC 07: GIVEN an authorized admin is logged in WHEN they add or update a sponsor’s name/logo/tagline/prompt/bonus designation THEN the attendee view reflects the changes without code changes.
•	AC 08: GIVEN an admin creates or updates a sponsor WHEN they request the sponsor QR code THEN a unique QR code is generated and can be exported for printing/display.
•	AC 09: GIVEN sponsors are configured (including any bonus stops) WHEN an attendee completes a bonus-designated stop THEN points/progress reflect the bonus stop configuration.
•	AC 10: GIVEN attendee activity has occurred WHEN an admin views metrics THEN the solution shows basic counts such as number of scans/check-ins per sponsor stop.
•	AC 11: GIVEN up to 500 users are using the solution simultaneously, THEN solution functionality is unaffected.

9: Recommended Solution Approach
Recommended Platform: M365 / Power Platform solution (web-based)
 This request is primarily a conference workflow and engagement experience (passport completion, content management, and basic reporting) rather than a spatial/GIS problem. Discovery emphasizes a mobile-friendly web link, sponsor content maintenance (logos/taglines/prompts), QR-based check-ins, and simple metrics—well aligned to a lightweight M365/Power Platform web experience with an admin-maintainable sponsor dataset and stored completion/points records.
10: Project Milestones (SDM → CSM → Delivery aligned)
Milestone 1 — Scope & Success Criteria Confirmation (SDM/CSM)
•	Objective: Lock a defensible scope aligned to conference needs and confirm “done” criteria.
•	Key Inputs: Discovery request (core functions, gamification items, dates), sponsor stop concepts, completion expectations.
•	Key Outputs: Approved scope summary, confirmed completion rules (required stops/points), confirmed admin responsibilities.
Milestone 2 — Content Model & Experience Design (Delivery)
•	Objective: Define the sponsor data model and attendee/admin experience flows.
•	Key Inputs: Sponsor fields (name/logo/tagline/prompt/bonus), QR requirement, metrics examples.
•	Key Outputs: Sponsor data structure, attendee flow (list → unlock → progress → completion), admin flow (manage sponsors → generate QR → view metrics).
Milestone 3 — Build & Configure Passport Experience (Delivery)
•	Objective: Implement the attendee passport, admin maintenance capability, QR generation, and progress/points tracking.
•	Key Inputs: Approved designs and data model, point/progress rules, sponsor content assets (initial set).
•	Key Outputs: Working web-accessible passport experience; admin management interface; QR codes generated per sponsor.
Milestone 4 — Validation, Content Load, & Launch Readiness (CSM/Delivery)
•	Objective: Ensure the solution works end-to-end for the conference and IPELRA can operate it.
•	Key Inputs: Final sponsor list/logos/taglines/prompts, device/browser testing expectations, completion verification approach.
•	Key Outputs: UAT sign-off, sponsors loaded, QR codes packaged for distribution, launch-ready solution with basic metrics available.

11: Notable Gaps & Assumptions
Gaps (not provided in discovery)
•	Systems/tools/datasets involved were not specified (blank in intake), including where sponsor and attendee progress data should live.
•	Attendee identification method is not defined (anonymous vs tied to registration/email), which impacts progress tracking, duplicate prevention, and prize verification.
•	Completion rule definition is not explicit (e.g., “all stops” vs “N stops” threshold; whether bonus stops are required or optional).
•	Points model is not explicitly defined (points per stop, bonus weighting).
•	Metrics detail is only described at a high level (“basic usage metrics” example given) and needs confirmation on exact reporting view/format.

Assumptions (required to scope delivery now)
•	The solution will be a web-accessible, mobile-friendly experience (per discovery) rather than a native app store deployment.
•	Sponsor stops will be maintained by IPELRA through a simple admin interface that supports add/update of sponsor name/logo/tagline and optional prompt.
•	“Basic metrics” will at minimum include count of check-ins/scans per sponsor stop as described in discovery.
•	QR codes are unique per sponsor and will be printed/displayed by sponsors at their tables.
•	No external integrations are required.
•	App needs to support up 500 concurrent users.
•	Solution will be hosted in MGP’s environment.

Questions
Should attendee participation be tracked anonymously (device/session-based) or tied to a known identifier (e.g., registration email/ID)?
What information will they want back in terms of users, usage, activity, etc.
Number of anticipated users.

