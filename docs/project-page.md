# Project page text (paste into the platform)

Field names follow the form seen on public projects. Check each field against the live form when you open it.

## Project title
Mendwell

## Tagline
Send the repair crew to the hand pump that matters.

## Challenge and track
`#3: Water Access - University Track`

## The Issue
About one hand pump in four in sub-Saharan Africa is broken at any moment (Foster et al., 2019: 26%, roughly 175,000 pumps in 2015). Most of these pumps sit in villages with no other safe source, and 2.1 billion people worldwide still lack safely managed drinking water (WHO/UNICEF JMP, 2025).

Repair crews usually learn a pump is down by driving there. A crew with one vehicle and one shift cannot visit every pump, so the pumps they choose decide who gets water back. Today that choice rests on whatever a district officer remembers and whichever pump is closest. A dead pump behind 2,000 people and a dead pump behind 200 look the same on a list.

Existing fixes cost money per pump: remote sensors on each handle, or new boreholes. Most districts cannot afford sensors on every pump, and the pumps most in need are the least likely to get them.

## Our Magic Solution
Mendwell is a web app for the district water office. It ranks every hand pump by how likely it is broken today, builds each technician's day around the people who need water most, and lets anyone at the pump report a failure from their phone with no account.

- **Rank.** A model trained on two national water point surveys (Sierra Leone and Uganda, about 35,500 real pumps from the open WPdx+ dataset) scores each pump from facts the ministry already holds: age, technology, who manages it, distance to roads and towns, and how many people use it.
- **Plan.** The planner picks the stops and the order for one shift, within the hours and road speed you set, and the crew returns to the depot. Each stop is judged on the chance it is broken times the people behind it, per hour of shift time.
- **Report.** Each pump gets a QR sticker. A villager scans it and taps "flowing", "weak" or "broken". The report moves that pump's score and the next plan, and fades after about two weeks.
- **Run.** The technician opens the route on a phone, taps "I'm here", records what they found, and the result is saved.

We tested it the hard way. For every plan we replayed real survey outcomes, with 220 random start points per country and an 8 hour shift. The model never saw the pump's neighbourhood when it scored it (spatial cross-validation), and the planner never saw the real status.

Results, Sierra Leone: a crew guided by Mendwell reaches about 2,500 people per shift, against about 830 for a crew that drives to the nearest pump each time, 3.1 times as many. In Uganda it is about 1,930 against 880. If the crew wants the most pumps fixed rather than the most people, the same planner fixes 2.4 pumps per shift against 2.0.

We also report what does not work well. The model alone is modest (AUC 0.68 in Sierra Leone, 0.73 in Uganda). Most of the gain comes from picking busy pumps and routing well, not from the model. A model trained in one country does not carry over to the other (AUC 0.52). We found and removed a data leak that had inflated our first model to 0.99. All of this is on the app's Evidence page.

Live demo: https://mendwell-pearl.vercel.app
Code: https://github.com/varshith-dev/mendwell
Demo video and slide deck: https://varshith-dev.github.io/mendwell/
Demo logins are on the README.

## How it works
1. Download the national water point survey for a country (open data, no cost, no key).
2. Train a model that scores each pump's chance of being broken, checked on areas it never saw.
3. The district officer picks a depot, shift length and road speed. Mendwell proposes the day's route.
4. The officer saves the route to a technician.
5. A villager scans the pump's QR sticker and reports. The pump's score moves.
6. The technician visits the stops in order, records what they find, and the plan for the next day starts from what was learned.

## Our Team
Varshith Paladugu, solo entrant. Second year B.Tech in Data Science (2025 to 2029), Malla Reddy University, Hyderabad, India. Built the data pipeline, model, planner, app and backtest.

(The team member must have registered on the platform first. Add yourself as the member.)

## Outside help (the rules ask to name it)
No teachers or mentors helped. I used AI coding assistants for development help (writing and reviewing code). The datasets are WPdx+ from the Water Point Data Exchange (https://data.waterpointdata.org, dataset eqje-vguj), cited in the app and README. The libraries are open source.

## Video field ("3-Minute Video Presentation & Demo Link")
https://varshith-dev.github.io/mendwell/mendwell-demo.mp4 (page with player and deck: https://varshith-dev.github.io/mendwell/). Max 1,000 characters. Narrated and demonstrated, as the form requires.

## Slide outline (public Google Slides link or PDF)
1. Title: Mendwell. Water Access, University track. Varshith Paladugu.
2. The problem: one pump in four is down. Crews find out by driving there. (JMP 2025, Foster 2019)
3. Why the order of visits matters: two broken pumps, 2,000 people against 200.
4. What Mendwell does: rank, plan, report. One screen shot of each.
5. Data: WPdx+ Sierra Leone 2016 and Uganda 2009, 35,502 pumps, with the leakage audit story.
6. Model: honest numbers. AUC 0.68 and 0.73, calibration, top 5% lift 2.4x and 2.9x.
7. Planner backtest: bar chart, nearest first against planner against planner with reports against upper bound.
8. Community reports: QR sticker, two taps, no account. How reports change a score.
9. Limits: old surveys, modest model, assumptions on speed and repair time, simulated reports.
10. Path to a pilot: one district water office, real reports, measure repairs per shift for a month.
11. Impact and cost: free open data, free hosting tier, a sticker per pump.
12. Contact and links.
