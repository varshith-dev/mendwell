# Demo video script (target 3:00 to 3:20)

The form says a narrated presentation and demo, about 3 minutes. The rules allow 3 to 4. Record the screen and speak over it. Keep your face optional. Aim for calm and clear, not fast. Times are a guide.

Before recording: run `npm run demo`, sign in as the officer in one window and keep `/p/<pump id>` open on your phone or a narrow window. Zoom the browser to 110%.

## 0:00 to 0:20. Who and what
On screen: landing page, hero map.

"Hi, I'm Varshith Paladugu, a second year B.Tech student in Data Science at Malla Reddy University in Hyderabad, India. I'm entering alone, in the University track, on challenge number three, Water Access. This is Mendwell."

## 0:20 to 0:50. The problem
On screen: scroll slowly to the stat band, then the board.

"About one hand pump in four in sub-Saharan Africa is broken at any moment. Repair crews usually find out by driving there. One crew gets one shift a day, so which pumps they visit decides who gets water back. Mendwell helps the district water office choose."



## 0:50 to 1:25. Rank
On screen: Board. Switch Sierra Leone, zoom into a district, click a red pump.

"Every dot is a real hand pump, about thirty-five thousand across Sierra Leone and Uganda, from the open WPdx+ dataset. Colour is the chance the pump is broken. The model uses things the ministry already knows: age, pump type, who manages it, distance to roads. On the right, districts are ranked by how many people sit behind probably-broken pumps. This pump shows the model's score and the score after community reports."

## 1:25 to 2:05. Plan
On screen: Dispatch. Pick Bo. Show the route, the people reached, the grey nearest-first line.

"Now the officer picks where the crew starts, the shift length and the road speed. Mendwell picks which pumps to visit and in what order, and brings the crew back to the depot. The grey line is a crew that drives to the nearest pump each time. In this plan the crew reaches about forty-seven percent more people than that crew. Over two hundred random starting points, the gap is three times as many people in Sierra Leone."

Check the on-screen figure for the depot you use and say that figure.

## 2:05 to 2:30. Report
On screen: phone view of `/p/<id>`, tap "Pump is broken", send. Back on the board, show the score move.

"Each pump gets a sticker with a QR code. A villager scans it and taps one of three buttons. No app, no account. The report moves this pump's score, and it fades after about two weeks."

## 2:30 to 2:50. Technician
On screen: `/route/demo-route` on a phone width. Tap "I'm here". Record an outcome.

"The technician follows the route on a phone. At each stop they tap I'm here, check the pump and record what they found. In this demo, the real survey status is hidden until that tap, so the planner can never peek."

## 2:50 to 3:15. Honesty and close
On screen: Evidence page, scroll through the ROC and backtest chart, then the limits list.

"I tested this on real outcomes, with cross-validation that never lets the model see a pump's neighbourhood. The model alone is modest, with an AUC of 0.68 in Sierra Leone. Most of the gain comes from routing to busy pumps. I found and removed a data leak that had inflated my first score to 0.99, and the app shows that too. The surveys are old and the speeds are assumptions, and I list those limits on screen.

Next step is a pilot with one district office. Thank you. The code and a live demo are linked on the project page."

## Checklist
- Says the team (just you), the University track, and Water Access: yes, in the first 20 seconds.
- Narrated, with the demo on screen throughout.
- Under 4 minutes. Export 1080p. Upload to YouTube as public or unlisted, and test the link logged out.
- Do not read numbers you have not checked against the app on the day.
