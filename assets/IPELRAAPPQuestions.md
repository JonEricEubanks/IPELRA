IPELRA CONFERENCE PASSPORT
Discovery Meeting Preparation Guide
Questions, Decision Framework & Notes Template
Prepared by MGP Technology Solutions  |  Client: IPELRA  |  Contact: Angie Miller

How to Use This Guide
This document is your meeting companion. Work through each question section in order. The most critical questions are in Section 1 — they block build decisions and must be answered before development begins. Use the Notes lines during the meeting to capture responses. Bring this document with you or share your screen if meeting virtually.

Meeting Agenda (Suggested 60 Minutes)
Time	Agenda Item	Owner
0:00 – 0:05	Welcome, introductions, meeting purpose	MGP (JonEric)
0:05 – 0:10	Quick overview of what we have designed so far (show Stitch prototype)	MGP (JonEric)
0:10 – 0:25	Section 1 — Critical decisions that block the build (7 questions)	MGP leads, IPELRA answers
0:25 – 0:40	Section 2 — Attendee experience details (6 questions)	MGP leads, IPELRA answers
0:40 – 0:50	Section 3 — Admin and sponsor content details (5 questions)	MGP leads, IPELRA answers
0:50 – 0:55	Section 4 — Conference logistics and launch readiness (4 questions)	MGP leads, IPELRA answers
0:55 – 1:00	Recap decisions, confirm next steps, assign action items	Both

 
Section 1 — Critical Decisions (Must Resolve Before Build)
Priority Note
These 7 questions are blockers. We cannot configure the backend logic, session expiry, completion thresholds, or points system until these are answered. If you leave the meeting with nothing else, get these answered.

Q1	Conference Dates
What is the actual conference date or date range?
Why this matters: This sets the session hard expiry. We configure the passport to lock automatically conference end date + 3 days. Without this we cannot set the cutoff.
–	Is it a single day or multi-day event? - Oct 4-7 (the 4th is arrivals, 5th is the conference start date)  Everything will be done by noon on Wed.
–	What city and venue? (Helps with connectivity planning) Eagle Ridge Resort in Galena, IL
–	Is there a registration deadline date we should also know? - Registration Deadline is forthcoming 
Notes:
 Conference runs Oct 4–7 in Galena. Oct 4 is arrival/pre conference; official conference days are Oct 5–7 (Mon–Wed). Most sponsor engagement happens Monday–Tuesday; by Wednesday most attendees depart by noon. Passport should go live starting Oct 5 and lock after conference end + 3 days. Registration deadline not yet finalized and will be provided later.

 
 

Q2	Completion Threshold
To earn a completed passport, does an attendee need to complete ALL sponsor stops or just a certain number of them?
Why this matters: This is the core rule that triggers the Completed Passport screen and prize eligibility. It drives the most important logic in the entire app.
–	Example: All 10 stops required? Or any 8 of 10? - Must visit all sponsors.
–	Is there a minimum number of required stops vs. optional stops? - no minimum.
–	Do bonus stops count toward the completion threshold or are they truly optional extras?  - No bonus stops.
Notes:
 Points‑based completion model instead of a strict visit‑all requirement. Final completion rule should be based on reaching a points threshold rather than every individual stop. 

 
 

Q3	Points Model
How many points does each sponsor stop award? Are all stops worth the same points or do some sponsors get more?
Why this matters: We need to configure a point value per sponsor in the database. Without this we cannot build the points counter or progress display.
–	Standard stop point value (e.g., 100 pts each)? - Platinum sponsors will have more points allocated to them.  One sponsor may have the QR code to get a headshot, for example.  
–	Bonus stop point value (e.g., 150 pts each)?
–	Is there a total points target attendees are aiming for or is it just for fun/display?
Notes:
Sponsors are tiered. Gold and Platinum are the only table sponsors. Gold stops suggested at ~100 points; Platinum stops at ~150 points to incentivize higher engagement. Final point totals and completion threshold will depend on final sponsor count.
 
 

Q4	Bonus Stops
Which sponsors are designated as bonus stops, and what does bonus mean for an attendee?
Why this matters: Bonus stops display differently in the app (gold badge) and award more points. We need to know if they are required for completion or purely optional for extra credit.
–	Are bonus stops required for passport completion or optional?
–	How many bonus stops are there expected to be?
–	Do bonus stops need to be identified before build or will IPELRA set that in the admin portal?
Notes:
No bonus stops confirmed yet. Committee will review whether any bonus concepts exist, but preference is to avoid adding complexity for year one unless something already exists operationally. Decision is forthcoming after committee meeting.

 
 

Q5	Prize Verification Process
When an attendee finishes their passport, how does IPELRA actually verify they are eligible for a prize at the prize table?
Why this matters: This determines whether we need a lookup feature for staff, a shareable digital stamp, or just the completed screen shown on the phone. It could change what we build.
–	Does the attendee show their phone screen to a staff member?
–	Does a staff member need to look them up by email in the admin portal?
–	Is there a separate prize drawing process (e.g., raffle, first come first served)?
–	Do we need to export a list of completed attendees?
Notes: IPELRA prefers an exportable list of completed attendees. Committee will conduct a random drawing offline. App should display a completed “Passport Finished” screen confirming raffle eligibility for the attendee. No on site lookup or phone screen validation required.



Q6	Admin Microsoft 365 Access
Does IPELRA have Microsoft 365 accounts (like Outlook or Teams) for the staff who will manage the admin portal?
Why this matters: This determines how we set up admin login. If they have M365 they can use their existing work email to sign in with no new accounts needed. If not we use a simpler shared login approach.
–	Which IPELRA staff will need admin portal access? (Names and emails if possible)
–	Do those staff members have work email accounts through Microsoft?
–	How many admin users are we expecting total?
Notes:
 IPELRA currently operates on Google Workspace, not M365. Admin users will likely authenticate using their individual municipal work email addresses (e.g., Marisol’s). This should be flagged as a requirement for admin access.

 
 

Q7	Expected Attendee Count
How many attendees are expected at the conference?
Why this matters: This confirms our Azure architecture is sized correctly and that we stay within free tier limits. It also affects how we think about QR scan volume and database load.
–	Approximate headcount? (e.g., 200, 500, 1000+)
–	Will all attendees participate in the passport or just a portion?
–	Is there a conference registration system we should be aware of?
Notes:
 
Typical attendance is ~150–160 people. Goal is participation by all attendees, though engagement may vary. Conference registration system exists but is managed through National PELRA; system name TBD.
 

 
Section 2 — Attendee Experience Details
These questions refine how attendees interact with the passport. Answers here drive screen design and unlock logic.

Q8	Attendee Entry & Identity
Are you comfortable with attendees entering their email address to access the passport, or do you prefer a different entry method?
Why this matters: We have designed a magic link email flow as the primary login. This is the simplest experience but requires attendees to have phone email access. We want to confirm IPELRA is comfortable with this approach.
–	Are attendees typically tech-comfortable at this conference?
–	Is there a registration system that generates attendee IDs or badge codes we could use instead?
–	Should the passport be completely open with no login at all? (Loses prize verification capability)
Email address is the preferred and simplest login method. Magic link email flow is acceptable. Passport should be open (no passwords or codes beyond email) to reduce attendee friction.
 
 
 

Q9	QR Code Unlock vs. Prompt
For sponsor stops that use a prompt question instead of QR — who writes those questions and what kind of answers are expected?
Why this matters: We store a question and expected answer per sponsor in the admin portal. Simple keyword answers work best. We need to know if IPELRA writes them, sponsors write them, or both.
–	Example: 'What does this sponsor specialize in?' Answer: 'cybersecurity'
–	Are all sponsors required to have both a QR code and a prompt, or is one optional?
–	How strict should the answer matching be? Exact match or close enough?
Notes:
 
Prompt questions are required (not QR scans). Purpose is to force sponsor interaction rather than drive by scanning. Prompt questions will be collected from sponsors. Answers should allow “close enough” matching, not exact phrasing
 

Q10	Progress Display Preference
How do you want progress shown to attendees — a progress bar, a checklist of stops, or both?
Why this matters: We have designed both a progress bar and a checklist-style card list. We want to confirm which feels right for the IPELRA audience before we finalize the design.
–	Should completed stops show a checkmark or disappear from the list?
–	Should the points total be prominently displayed or kept subtle?
–	Any preference on color or visual style for completion indicators?
Notes:
 
Progress bar preferred over checklist to reinforce gamification and momentum.
 

Q11	Offline / Connectivity Concerns
Are there known WiFi or cell service limitations at the conference venue?
Why this matters: Conference venues can have spotty connectivity. We can build offline resilience so progress saves locally and syncs when connection restores. We need to know if this is a concern.
–	Is venue WiFi available for attendees?
–	Has connectivity been an issue at past IPELRA events?
–	Would you want the app to work fully offline, or is connectivity expected to be reliable?
Notes:
 No explicit connectivity issues discussed during the meeting. No offline requirement confirmed yet.

 
 

Q12	Branding & Visual Style
What branding should the passport reflect — IPELRA branding, conference branding, or both?
Why this matters: We need logo files and color preferences before build. If there is a specific conference theme or color palette we should match it.
–	Can you provide the IPELRA logo in PNG or SVG format?
–	Is there a specific conference name or theme for this year's event?
–	Are there brand colors or a style guide we should follow?
–	Should sponsor logos come from the sponsors directly or does IPELRA collect them?
Notes:
Passport should follow the IPELRA conference theme branding. IPELRA will supply logo files, color palette, and theme details. Sponsor logos will be collected centrally by IPELRA and provided to MGP.
 
 

Q13	Conference Passport Naming
What do you want to call the passport experience in the app? Do you have a preferred name?
Why this matters: The app currently uses IPELRA Conference Passport as the working title. If IPELRA has a branded name for this activity we should use it throughout.
–	Example options: IPELRA Sponsor Passport, Conference Scavenger Hunt, Sponsor Trail
–	Should the word 'passport' be used or is there a preferred term?
Notes:
“Conference Passport” is a working title only. Committee will determine final name, possibly tied to the annual conference theme.
 

 
Section 3 — Admin & Sponsor Content Details
These questions ensure IPELRA can operate the admin portal independently and that sponsor content is ready before launch.

Q14	Sponsor List & Content Readiness
How many sponsors are expected in the passport and when will their content be ready?
Why this matters: We need sponsor names, logos, taglines, and optional prompts loaded before the conference. This is often the last thing ready and the biggest launch risk.
–	Approximate number of sponsors participating in the passport?
–	Who is responsible for collecting sponsor logos and content — IPELRA or the sponsors themselves?
–	What is the deadline for all sponsor content to be submitted?
–	Will sponsors send content in a consistent format or do we expect variation?
Notes:
Historically ~13 sponsors; max projected ~15 due to space constraints. Final count driven by sponsorship revenue goals. Sponsor content deadlines still TBD by committee.
 
 

Q15	Admin Portal Users & Training
Who at IPELRA will be using the admin portal and how comfortable are they with web-based tools?
Why this matters: We want to make sure the right people have access and that we plan appropriate training before the conference. If admins are less tech-savvy we may simplify the interface.
–	Names and roles of expected admin users?
–	Will admins need to update sponsor content frequently before the conference or just a few times?
–	Would a short training session or walkthrough video be helpful?
Notes:
Expect ~3 admin users across conference and sponsorship committees. Short walkthrough or training video would be useful depending on comfort level
 

Q16	QR Code Distribution
How will the QR codes get from the app to the sponsor tables?
Why this matters: We generate printable QR codes per sponsor in the admin portal. We need to understand who is responsible for printing and distributing them so we can make the export format work for that process.
–	Will IPELRA print and deliver QR codes to sponsors, or will sponsors print their own?
–	What size should the QR codes be printed at? (Table tent, full sheet, signage?)
–	Is there a specific format needed — PDF, PNG, or other?
Notes: Not applicable because sponsor check ins will use prompt questions instead of QR codes.

 
 
 

Q17	Metrics & Reporting Needs
What data do you want to see in the metrics dashboard and what will you do with it after the conference?
Why this matters: We have basic check-in counts per sponsor planned. We want to confirm if IPELRA needs anything beyond that — for example a downloadable attendee completion list or sponsor-specific reports.
–	Is a simple check-in count per sponsor sufficient or do you need more detail?
–	Do you need a list of attendees who completed the passport for prize drawing?
–	Will metrics be shared with sponsors after the conference?
–	Do you need data exported to Excel or another format?
Notes:
 
IPELRA wants:
– Check in counts per sponsor
– Total participant count
– Insight into completion vs drop off behavior
– Exportable list with attendee emails for raffle and follow up
Metrics may be shared with sponsors post conference.
 
 

Q18	Post-Conference Data Handling
After the conference is over, what should happen to attendee data?
Why this matters: We plan to lock the passport after conference end plus three days. We want to know how long to retain attendee progress data and whether IPELRA needs it exported before teardown.
–	Should attendee email and completion data be exported before we shut down the app?
–	Are there any data privacy or retention requirements we should be aware of?
–	Who should receive the final data export?
Notes:
No special data retention restrictions identified. Passport will lock after conference + 3 days. Final data export should go to Marisol for committee use
 
 

 
Section 4 — Logistics & Launch Readiness
These questions cover the practical details of getting the app live and tested before the conference.

Q19	Custom Domain
Do you want a custom URL for the passport or is a generic Azure URL acceptable?
Why this matters: Azure Static Web Apps provides a free URL like myapp.azurestaticapps.net. If IPELRA wants something like passport.ipelra.org we need a domain registered and DNS configured in advance.
–	Does IPELRA own a domain (e.g., ipelra.org)?
–	Who manages IPELRA's DNS — internal IT or a vendor?
–	Is a branded URL important for the attendee experience or is a generic link acceptable?
Notes:
National PELRA owns the domain. Branded URL would be nice, but not required if DNS coordination is complex. Generic Azure URL is acceptable.
 
 

Q20	UAT & Testing Plan
Who will test the app before the conference and what does a successful test look like for IPELRA?
Why this matters: We need at least one round of user acceptance testing with real devices before launch. This means loading real sponsor content and walking through the full attendee flow end to end.
–	Who from IPELRA will participate in testing?
–	Do you have access to multiple phone types for testing (iPhone and Android)?
–	How much lead time before the conference do you need to feel comfortable the app is ready?
–	Is there a specific date by which the app must be launch-ready?
Notes:
 UAT participants and target dates not finalized. Committee involvement expected once sponsor content is loaded.

 
 

Q21	On-Site Support
Will MGP need to provide any on-site or on-call support during the conference?
Why this matters: We want to understand expectations around day-of support in case attendees have issues or something unexpected occurs. We can configure monitoring alerts but want to align on response expectations.
–	Is remote support during the event acceptable or is on-site presence expected?
–	Who is the IPELRA point of contact on the day of the conference for tech issues?
–	Should we prepare a simple troubleshooting guide for IPELRA staff to handle common attendee questions?
Notes:
 No explicit expectation set yet. Remote support likely acceptable, pending further discussion.

 
 

Q22	Future Use
Is this a one-time build for this conference or would IPELRA want to reuse the passport app for future events?
Why this matters: This affects how we architect for reusability. A one-time build can be simpler. A reusable platform requires more configuration flexibility but is a better long-term investment.
–	Is this an annual conference where the passport would be reused each year?
–	Would IPELRA want to manage future updates independently or always engage MGP?
–	Are there other IPELRA events that could use a similar passport experience?
Notes:
 Future reuse not explicitly decided, but discussion acknowledged potential for reuse beyond a one time build. No commitment yet.

 
 

 
Decision Log — To Complete During Meeting
Use this table to record confirmed decisions in real time. These become the official scope confirmation after the meeting.

Decision Item	Answer / Decision	Owner / Notes
Conference date(s)		
Completion threshold (all stops or N of X)		
Standard stop point value		
Bonus stop point value		
Bonus stops required or optional for completion		
Prize verification method		
Admin login approach (M365 / Entra / Simple)		
Expected attendee count		
Attendee entry method (magic link / code / open)		
QR vs. prompt — who writes prompt questions		
Progress display (bar / checklist / both)		
Offline resilience needed (yes / no)		
Branding — logo and colors confirmed		
Passport name / branded title		
Number of sponsors		
Sponsor content deadline		
Admin users and training needed		
QR code format and print responsibility		
Metrics needs beyond basic check-in counts		
Post-conference data export needed (yes / no)		
Custom domain needed (yes / no)		
UAT lead and target ready date		
On-site support expectation		
One-time or reusable platform		

 
Post-Meeting Action Items
Complete this section at the end of the meeting to confirm who does what before the next milestone.

Action Item	Owner	Due Date
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 
 	 	 

Next Steps After This Meeting
1. MGP sends meeting summary with confirmed decisions within 24 hours. 2. IPELRA reviews and approves the decision log. 3. MGP updates the Architecture Blueprint to reflect confirmed decisions. 4. Build begins on Milestone 3 once scope is locked and sponsor content deadline is confirmed.



IPELRA Conference Passport  |  Discovery Meeting Prep Guide
Prepared by MGP Technology Solutions  |  Confidential
