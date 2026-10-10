/**
 * Hebrew for the Inbox's data (plan v2, E7): the inbox-v1 threads (src/infra/seed/inbox.ts), the inbox-v1
 * classification reasons and the prepared follow-up answers (src/domain/inbox.ts). The database keeps the English
 * original; the reader's language is applied when a view is shown (ADR-007).
 */
export const HE_INBOX: Record<string, string> = {
  "Overtime for the North DC second shift: exception to the freeze?":
    "שעות נוספות למשמרת שנייה במרכז ההפצה בצפון: חריגה מהקפאת ההוצאות?",
  "Dana, Noa asks for an exception to the spend freeze: a second DC shift on overtime for two weeks, ₪180k. Without it the North delays continue. Can you approve it, capped at two weeks?":
    "דנה, נועה מבקשת חריגה מהקפאת ההוצאות: משמרת שנייה בשעות נוספות במרכז ההפצה לשבועיים, ₪180k. בלעדיה העיכובים בצפון יימשכו. תוכלי לאשר, עם תקרה של שבועיים?",
  "North deliveries recover about a week sooner, which protects the 14 branches' weekly sales.":
    "המשלוחים בצפון יתאוששו כשבוע מוקדם יותר, וזה מגן על המכירות השבועיות של 14 הסניפים.",
  "Approve as an exception, capped at ₪180k and two weeks, with a review on day 7.":
    "לאשר כחריגה, עם תקרה של ₪180k ושבועיים, ובדיקה ביום 7.",
  "Michal, approved as an exception to the freeze: ₪180k cap, two weeks, and a review with Noa on day 7. Dana":
    "מיכל, מאושר כחריגה מההקפאה: תקרה של ₪180k, שבועיים, ובדיקה עם נועה ביום 7. דנה",
  "Run the Q4 campaign at ₪220k instead of ₪350k?": "להריץ את קמפיין הרבעון הרביעי ב־₪220k במקום ₪350k?",
  "Dana, Finance's freeze blocks the ₪350k campaign. I can launch on time with ₪220k (fewer TV spots, same in-store). Are you OK with that?":
    "דנה, הקפאת ההוצאות של הכספים חוסמת את הקמפיין של ₪350k. אני יכולה להשיק בזמן עם ₪220k (פחות תשדירי טלוויזיה, אותו דבר בחנויות). זה בסדר מבחינתך?",
  "The launch keeps its date; the cut comes from TV, which drives the least store traffic.":
    "ההשקה שומרת על התאריך; הקיצוץ בא מהטלוויזיה, שמביאה הכי פחות תנועה לחנויות.",
  "Agree to ₪220k and ask Michal to confirm the reallocation by tomorrow 12:00.":
    "להסכים ל־₪220k ולבקש ממיכל לאשר את הקצאת התקציב עד מחר ב־12:00.",
  "Ronit, ₪220k works for me if the launch date holds. Michal, please confirm the reallocation by tomorrow 12:00.":
    "רונית, ₪220k מתאים לי אם תאריך ההשקה נשמר. מיכל, בבקשה אשרי את הקצאת התקציב עד מחר ב־12:00.",
  "Recall: press statement ready for your review": "ריקול: הודעה לעיתונות מוכנה לבדיקתך",
  "Dana, the regulator acknowledged our notice. The press statement on batch 4471 is ready; Legal has checked it. Can you approve it before 14:00 today?":
    "דנה, הרגולטור אישר את קבלת ההודעה שלנו. ההודעה לעיתונות על אצווה 4471 מוכנה; המחלקה המשפטית בדקה אותה. תוכלי לאשר לפני 14:00 היום?",
  "A statement out before the evening news keeps the story about our quick recall, not about silence.":
    "הודעה שיוצאת לפני מהדורת הערב משאירה את הסיפור על הריקול המהיר שלנו, לא על שתיקה.",
  "Approve the statement as drafted.": "לאשר את ההודעה כפי שנוסחה.",
  "Yael, approved as drafted. Please send it out before 14:00 and share the coverage tonight. Dana":
    "יעל, מאושר כפי שנוסח. בבקשה שלחי לפני 14:00 ושתפי את הסיקור הערב. דנה",
  "POS wave 3 needs ₪400k more": "גל 3 של הקופות דורש ₪400k נוספים",
  "Michal, the vendor's change order for POS wave 3 is ₪400k over budget (new payment terminals). Can Finance release it this week so wave 3 starts on 26 October?":
    "מיכל, הזמנת השינוי של הספק לגל 3 של הקופות חורגת ב־₪400k מהתקציב (מסופי תשלום חדשים). הכספים יכולים לשחרר את זה השבוע כדי שגל 3 יתחיל ב־26 באוקטובר?",
  "Wave 3 starts on time and the old terminals are out before the holiday peak.":
    "גל 3 מתחיל בזמן והמסופים הישנים יוצאים לפני שיא החגים.",
  "Ask for a phased plan: release ₪150k for the terminals now, the rest after the holiday.":
    "לבקש תוכנית בשלבים: לשחרר עכשיו ₪150k למסופים, ואת השאר אחרי החג.",
  "Amir, I can release ₪150k now for the terminals. Please send a phased plan for the remaining ₪250k after the holiday.":
    "אמיר, אני יכולה לשחרר עכשיו ₪150k למסופים. בבקשה שלח תוכנית בשלבים ל־₪250k הנותרים אחרי החג.",
  "Q4 labor re-forecast for the wage rule: sign off today?":
    "תחזית שכר מעודכנת לרבעון הרביעי בגלל כלל השכר: לאשר היום?",
  "Michal, the new wage rule adds about ₪120k a week to labor cost from next month. Can Finance sign off the Q4 re-forecast today so payroll can load the new tables?":
    "מיכל, כלל השכר החדש מוסיף כ־₪120k בשבוע לעלות השכר מהחודש הבא. הכספים יכולים לאשר היום את התחזית המעודכנת לרבעון הרביעי כדי שהשכר יטען את הטבלאות החדשות?",
  "Payroll loads compliant tables in time; the board sees the cost in the Q4 forecast, not as a surprise.":
    "מחלקת השכר טוענת טבלאות תקינות בזמן; הדירקטוריון רואה את העלות בתחזית הרבעון ולא כהפתעה.",
  "Sign off the re-forecast and flag the ₪120k a week in the board pack.":
    "לאשר את התחזית המעודכנת ולסמן את ה־₪120k בשבוע בחבילת הדירקטוריון.",
  "Hila, signed off: the Q4 re-forecast includes the ₪120k a week. I am adding it to the board pack. Michal":
    "הילה, מאושר: התחזית המעודכנת לרבעון הרביעי כוללת את ה־₪120k בשבוע. אני מוסיפה את זה לחבילת הדירקטוריון. מיכל",
  "Q3 review: inventory count date": "סקירת רבעון 3: מועד ספירת המלאי",
  "Michal, for the Q3 review we need to observe one inventory count. Can you confirm 3 November at the Center DC?":
    "מיכל, לסקירת רבעון 3 עלינו לנכוח בספירת מלאי אחת. תוכלי לאשר את 3 בנובמבר במרכז ההפצה המרכזי?",
  "Confirming now keeps the review on schedule for the board meeting.":
    "אישור עכשיו שומר על לוח הזמנים של הסקירה לקראת ישיבת הדירקטוריון.",
  "Confirm 3 November and copy Noa, who runs the Center DC.":
    "לאשר את 3 בנובמבר ולהעתיק את נועה, שמנהלת את מרכז ההפצה המרכזי.",
  "Orly, 3 November at the Center DC is confirmed. Noa Friedman (Supply Chain) will host. Michal":
    "אורלי, 3 בנובמבר במרכז ההפצה המרכזי מאושר. נועה פרידמן (שרשרת אספקה) תארח. מיכל",
  "Orly Shani": "אורלי שני",
  "Audit partner, external auditors": "שותפה מבקרת, רואי החשבון המבקרים",
  "Reroute two trucks via the Center DC for three days?": "להסיט שתי משאיות דרך מרכז ההפצה המרכזי לשלושה ימים?",
  "Oren, rerouting two trucks via the Center DC for three days would cover the 14 branches while the North DC recovers. It costs about ₪24k. Do I have your OK?":
    "אורן, הסטה של שתי משאיות דרך מרכז ההפצה המרכזי לשלושה ימים תכסה את 14 הסניפים בזמן שמרכז ההפצה בצפון מתאושש. העלות כ־₪24k. יש לי אישור ממך?",
  "Shelves in 14 branches are refilled within a day instead of waiting for the North DC.":
    "המדפים ב־14 סניפים מתמלאים תוך יום במקום לחכות למרכז ההפצה בצפון.",
  "Approve the reroute for three days; Noa reports the fill rate daily.":
    "לאשר את ההסטה לשלושה ימים; נועה מדווחת על שיעור המילוי מדי יום.",
  "Noa, approved: reroute two trucks via the Center DC for three days. Please send me the fill rate daily. Oren":
    "נועה, מאושר: להסיט שתי משאיות דרך מרכז ההפצה המרכזי לשלושה ימים. בבקשה שלחי לי את שיעור המילוי מדי יום. אורן",
  "Weekend staffing uplift for 9 North branches": "תגבור כוח אדם בסוף השבוע ל־9 סניפים בצפון",
  "Oren, with the stock-outs before the holiday weekend I want 2 extra people per shift in the 9 North branches, Thursday to Saturday. OK to go ahead?":
    "אורן, בגלל החוסרים לפני סוף שבוע החג אני רוצה 2 עובדים נוספים בכל משמרת ב־9 הסניפים בצפון, מחמישי עד שבת. אפשר להתקדם?",
  "Restocking keeps pace with the incoming transfer, so the holiday weekend sales are not lost.":
    "המילוי במדפים עומד בקצב ההעברה הנכנסת, כך שמכירות סוף שבוע החג לא הולכות לאיבוד.",
  "Approve for this weekend only and review after the holiday.": "לאשר לסוף השבוע הזה בלבד ולבדוק אחרי החג.",
  "Shira, approved for this weekend only. Let's review the numbers on Sunday. Oren":
    "שירה, מאושר לסוף השבוע הזה בלבד. נבדוק את המספרים ביום ראשון. אורן",
  "Driver shortage next week": "מחסור בנהגים בשבוע הבא",
  "Oren, we are short of 6 drivers next week because of reserve duty. Can you move two delivery waves from Sunday to Monday?":
    "אורן, חסרים לנו 6 נהגים בשבוע הבא בגלל מילואים. תוכל להעביר שני גלי משלוחים מיום ראשון ליום שני?",
  "An early answer lets Supply Chain replan the waves instead of losing them.":
    "תשובה מוקדמת מאפשרת לשרשרת האספקה לתכנן מחדש את הגלים במקום לאבד אותם.",
  "Ask Noa to replan Sunday's two waves to Monday and confirm with the contractor.":
    "לבקש מנועה לתכנן מחדש את שני הגלים של יום ראשון ליום שני ולאשר מול הקבלן.",
  "Avner, thanks for the warning. Noa Friedman will confirm the new plan for the two Sunday waves by tomorrow. Oren":
    "אבנר, תודה על ההתראה. נועה פרידמן תאשר את התוכנית החדשה לשני הגלים של יום ראשון עד מחר. אורן",
  "Avner Golan": "אבנר גולן",
  "Fleet contractor": "קבלן הובלה",
  "Evening security guard at Dizengoff for two weeks?": "מאבטח ערב בדיזנגוף לשבועיים?",
  "Shira, shrinkage at Dizengoff is still rising, mostly health & beauty in the evenings. An evening guard for two weeks costs ₪16k. Can I book one from Sunday?":
    "שירה, הפחת בדיזנגוף ממשיך לעלות, בעיקר בטיפוח ויופי בשעות הערב. מאבטח ערב לשבועיים עולה ₪16k. אפשר להזמין מיום ראשון?",
  "Stops the evening losses while the stock audit finds the cause.":
    "עוצר את ההפסדים בערבים עד שספירת המלאי תמצא את הסיבה.",
  "Approve two weeks and ask for the stock audit results before extending.":
    "לאשר שבועיים ולבקש את תוצאות ספירת המלאי לפני הארכה.",
  "Lior, approved for two weeks from Sunday. Send me the stock audit results before we extend. Shira":
    "ליאור, מאושר לשבועיים מיום ראשון. שלח לי את תוצאות ספירת המלאי לפני שנאריך. שירה",
  "Autumn rosters for 12 Center branches": "סידורי עבודה לסתיו ל־12 סניפים במרכז",
  "Shira, the new autumn rosters bring Center labor back to plan (about −6%). They need your approval before Thursday's publish. Can you approve?":
    "שירה, סידורי העבודה החדשים לסתיו מחזירים את השכר במרכז לתוכנית (כ־6%−). הם צריכים את אישורך לפני הפרסום ביום חמישי. תוכלי לאשר?",
  "Labor cost in the Center returns to plan from next week.": "עלות השכר במרכז חוזרת לתוכנית מהשבוע הבא.",
  "Approve the rosters.": "לאשר את סידורי העבודה.",
  "Maya, approved. Please publish on Thursday as planned. Shira": "מאיה, מאושר. בבקשה פרסמי ביום חמישי כמתוכנן. שירה",
  "Holiday opening hours in the North": "שעות הפתיחה בחג בצפון",
  "Shira, three North branches want to open an hour later on the holiday eve because of staffing. Can we agree on that before the website is updated?":
    "שירה, שלושה סניפים בצפון רוצים לפתוח שעה מאוחר יותר בערב החג בגלל כוח אדם. נוכל להסכים על זה לפני שהאתר מתעדכן?",
  "The website and the stores show the same hours on the holiday eve.": "האתר והחנויות מציגים את אותן שעות בערב החג.",
  "Agree for the three branches and ask IT to update the website today.":
    "להסכים לשלושת הסניפים ולבקש מ־IT לעדכן את האתר היום.",
  "Yossi, agreed for the three branches. I've asked IT to update the website today. Shira":
    "יוסי, מוסכם לשלושת הסניפים. ביקשתי מ־IT לעדכן את האתר היום. שירה",
  "Temporary DC staff 4 days late: second agency at +15%?":
    "עובדים זמניים למרכז ההפצה באיחור של 4 ימים: חברת השמה שנייה ב־15%+?",
  "Noa, the first agency is 4 days late with the temporary DC staff. A second agency can start Sunday at +15% on the hourly rate. Shall I sign?":
    "נועה, חברת ההשמה הראשונה מאחרת ב־4 ימים עם העובדים הזמניים למרכז ההפצה. חברה שנייה יכולה להתחיל ביום ראשון ב־15%+ על התעריף השעתי. לחתום?",
  "The North DC gets back to full waves four days sooner.": "מרכז ההפצה בצפון חוזר לגלים מלאים ארבעה ימים מוקדם יותר.",
  "Sign with the second agency for two weeks and claim the delay penalty from the first.":
    "לחתום עם החברה השנייה לשבועיים ולתבוע את קנס האיחור מהראשונה.",
  "Ben, sign with the second agency for two weeks. Please also claim the delay penalty from the first agency. Noa":
    "בן, תחתום עם החברה השנייה לשבועיים. בבקשה גם תתבע את קנס האיחור מהחברה הראשונה. נועה",
  "When will the replenishment reach Haifa Grand Canyon?": "מתי ההשלמה תגיע להייפה גרנד קניון?",
  "Noa, our dairy and bakery shelves are half empty. When will the replenishment I asked for arrive?":
    "נועה, מדפי מוצרי החלב והמאפים שלנו חצי ריקים. מתי תגיע ההשלמה שביקשתי?",
  "Avi can plan staff and tell customers when the shelves are full again.":
    "אבי יכול לתכנן כוח אדם ולומר ללקוחות מתי המדפים יתמלאו שוב.",
  "Give Avi a delivery window and confirm the transfer from Haifa Carmel.":
    "לתת לאבי חלון משלוח ולאשר את ההעברה מחיפה כרמל.",
  "Avi, the transfer from Haifa Carmel arrives tomorrow before 10:00. I'll confirm when the truck leaves. Noa":
    "אבי, ההעברה מחיפה כרמל מגיעה מחר לפני 10:00. אאשר כשהמשאית יוצאת. נועה",
  "Dairy Co.: delivery slots change from Sunday": "Dairy Co.: חלונות המשלוח משתנים מיום ראשון",
  "Noa, from Sunday our trucks reach your DCs at 05:00 instead of 06:30. Please confirm your docks can receive them.":
    "נועה, מיום ראשון המשאיות שלנו יגיעו למרכזי ההפצה שלכם ב־05:00 במקום ב־06:30. בבקשה אשרי שהרציפים יכולים לקבל אותן.",
  "Earlier dairy deliveries reach the shelves before the morning rush.":
    "משלוחי חלב מוקדמים יותר מגיעים למדפים לפני עומס הבוקר.",
  "Confirm and ask Ben to move the dock shift.": "לאשר ולבקש מבן להזיז את משמרת הרציף.",
  "Rafi, confirmed for Sunday. Ben Shalom will move the dock shift to 05:00. Noa":
    "רפי, מאושר ליום ראשון. בן שלום יזיז את משמרת הרציף ל־05:00. נועה",
  "Rafi Ezra": "רפי עזרא",
  "Logistics manager, Dairy Co.": "מנהל לוגיסטיקה, Dairy Co.",
  "Price increase of 7% on 120 SKUs from 1 November": "העלאת מחיר של 7% על 120 מק״טים מ־1 בנובמבר",
  "Eitan, as announced, our prices rise by 7% on 120 SKUs from 1 November. Please confirm by Friday so we can update your price lists.":
    "איתן, כפי שהודענו, המחירים שלנו עולים ב־7% על 120 מק״טים מ־1 בנובמבר. בבקשה אשר עד יום שישי כדי שנעדכן את מחירוני הרשת.",
  "Holding the old prices for 30 days protects the margin on the promotion already planned on 30 of the SKUs.":
    "שמירה על המחירים הישנים ל־30 יום מגינה על הרווח במבצע שכבר מתוכנן על 30 מהמק״טים.",
  "Invoke the 30-day price-protection clause and negotiate the increase on the other 90 SKUs.":
    "להפעיל את סעיף הגנת המחיר ל־30 יום ולנהל משא ומתן על ההעלאה ב־90 המק״טים האחרים.",
  "Gadi, we are invoking the 30-day price-protection clause in our agreement. We are ready to discuss the other 90 SKUs next week. Eitan":
    "גדי, אנחנו מפעילים את סעיף הגנת המחיר ל־30 יום שבהסכם שלנו. נשמח לדון ב־90 המק״טים האחרים בשבוע הבא. איתן",
  "Gadi Levin": "גדי לוין",
  "Sales director, Dairy Co.": "מנהל מכירות, Dairy Co.",
  "Overstock offer: 25% off two categories, 5 days": "הצעת עודפי מלאי: 25% הנחה על שתי קטגוריות, 5 ימים",
  "Eitan, we can offer 25% off our snacks and cereal bars for a full truckload each, if you order within 5 days. Interested?":
    "איתן, אנחנו יכולים להציע 25% הנחה על החטיפים וחטיפי הדגנים שלנו, משאית מלאה מכל אחד, אם תזמינו תוך 5 ימים. מעוניין?",
  "Cheaper stock in two categories where we already lead on price.":
    "מלאי זול יותר בשתי קטגוריות שבהן אנחנו כבר מובילים במחיר.",
  "Counter at half the volume, so the stock sells before its date.":
    "להציע חצי מהכמות, כדי שהמלאי יימכר לפני תאריך התפוגה.",
  "Dror, thanks for the offer. We can take half a truckload of each at 25% off, delivered next week. Eitan":
    "דרור, תודה על ההצעה. נוכל לקחת חצי משאית מכל אחד ב־25% הנחה, באספקה בשבוע הבא. איתן",
  "Dror Sasson": "דרור ששון",
  "Key account manager, Snackworks": "מנהל לקוחות מפתח, Snackworks",
  "Hold the Coast delisting a week?": "לדחות בשבוע את ההוצאה מהמבחר בחוף?",
  "Eitan, our Coast promotion includes 14 items you are delisting. Can you hold the delisting one week so the promotion runs as printed?":
    "איתן, המבצע שלנו בחוף כולל 14 פריטים שאתם מוציאים מהמבחר. תוכל לדחות את ההוצאה בשבוע כדי שהמבצע ירוץ כפי שהודפס?",
  "The promotion runs as printed and the delisting follows a week later, with no empty shelf tags.":
    "המבצע רץ כפי שהודפס וההוצאה מהמבחר באה שבוע אחריו, בלי תגיות מדף ריקות.",
  "Swap the 14 items for their replacements instead of holding the delisting.":
    "להחליף את 14 הפריטים בתחליפים שלהם במקום לדחות את ההוצאה מהמבחר.",
  "Ronit, I'd rather not hold it: let's swap the 14 items for their replacements in the promo. My team sends the list today. Eitan":
    "רונית, אני מעדיף לא לדחות: בואי נחליף את 14 הפריטים בתחליפים שלהם במבצע. הצוות שלי שולח את הרשימה היום. איתן",
  "Holiday assets: full set Friday 10:00, or a reduced set now?":
    "חומרי החג: סט מלא ביום שישי ב־10:00, או סט מצומצם עכשיו?",
  "Ronit, the full asset set will be ready Friday at 10:00. We can send a reduced set for in-house printing today. Which do you want?":
    "רונית, הסט המלא יהיה מוכן ביום שישי ב־10:00. אנחנו יכולים לשלוח היום סט מצומצם להדפסה פנימית. מה את מעדיפה?",
  "Signage reaches all 60 branches before the launch.": "השילוט מגיע לכל 60 הסניפים לפני ההשקה.",
  "Take the reduced set now for in-house printing, and the full set Friday for the second week.":
    "לקחת עכשיו את הסט המצומצם להדפסה פנימית, ואת הסט המלא ביום שישי לשבוע השני.",
  "Keren, please send the reduced set today for in-house printing, and the full set on Friday for the second week. Ronit":
    "קרן, בבקשה שלחי היום את הסט המצומצם להדפסה פנימית, ואת הסט המלא ביום שישי לשבוע השני. רונית",
  "Keren Avital": "קרן אביטל",
  "Account director, Studio North (creative agency)": "מנהלת לקוחות, סטודיו צפון (משרד פרסום)",
  "Campaign budget: can you live with ₪220k?": "תקציב הקמפיין: תוכלי להסתדר עם ₪220k?",
  "Ronit, I can reallocate ₪220k from IT phase 2 to the Q4 campaign, not ₪350k. Can you work with that?":
    "רונית, אני יכולה להעביר ₪220k משלב 2 של IT לקמפיין הרבעון הרביעי, לא ₪350k. תוכלי לעבוד עם זה?",
  "The campaign is funded and launches on time.": "הקמפיין ממומן ומושק בזמן.",
  "Accept ₪220k and cut TV spots, not in-store.": "לקבל ₪220k ולקצץ בתשדירי טלוויזיה, לא בחנויות.",
  "Michal, yes, ₪220k works. I'll cut TV spots and keep in-store as planned. Ronit":
    "מיכל, כן, ₪220k מתאים. אקצץ בתשדירי טלוויזיה ואשאיר את החנויות כמתוכנן. רונית",
  "Competitor closing near Ramat Gan: a welcome campaign?": "מתחרה נסגר ליד רמת גן: קמפיין קבלת פנים?",
  "Ronit, the competitor store near Ramat Gan Ayalon closes in three weeks. Can you propose a welcome campaign for their shoppers by Sunday?":
    "רונית, חנות המתחרה ליד רמת גן איילון נסגרת בעוד שלושה שבועות. תוכלי להציע קמפיין קבלת פנים ללקוחות שלהם עד יום ראשון?",
  "We reach their shoppers before they settle on another chain.":
    "אנחנו מגיעים ללקוחות שלהם לפני שהם מתרגלים לרשת אחרת.",
  "Propose a local loyalty offer and leaflets within 3 km, ready by Sunday.":
    "להציע הטבת מועדון מקומית ועלונים בטווח 3 ק״מ, מוכנים עד יום ראשון.",
  "Dana, I'll send a proposal by Sunday: a local loyalty offer and leaflets within 3 km of the store. Ronit":
    "דנה, אשלח הצעה עד יום ראשון: הטבת מועדון מקומית ועלונים בטווח 3 ק״מ מהחנות. רונית",
  "Updated pay tables: Legal needs them by Thursday": "טבלאות שכר מעודכנות: המחלקה המשפטית צריכה אותן עד יום חמישי",
  "Hila, to clear the new pay tables before the wage rule starts, Legal needs them by Thursday. Can you send them today?":
    "הילה, כדי לאשר את טבלאות השכר החדשות לפני שכלל השכר נכנס לתוקף, המחלקה המשפטית צריכה אותן עד יום חמישי. תוכלי לשלוח היום?",
  "The pay tables are cleared before the rule starts, so payroll is compliant on day one.":
    "טבלאות השכר מאושרות לפני שהכלל נכנס לתוקף, כך שהשכר תקין מהיום הראשון.",
  "Send today's draft and agree a review slot with Legal for Wednesday.":
    "לשלוח את הטיוטה של היום ולקבוע מועד בדיקה עם המחלקה המשפטית ליום רביעי.",
  "Yael, sending today's draft now. Can we review it together on Wednesday at 11:00? Hila":
    "יעל, שולחת עכשיו את הטיוטה של היום. נוכל לעבור עליה יחד ביום רביעי ב־11:00? הילה",
  "POS training for the 5 pilot branches next week?": "הדרכת קופות ל־5 סניפי הפיילוט בשבוע הבא?",
  "Hila, if the POS cut-over moves after the holiday, we pilot in 5 branches first. Can HR book the training for next week?":
    "הילה, אם המעבר לקופות החדשות נדחה לאחרי החג, נתחיל בפיילוט ב־5 סניפים. משאבי אנוש יכולים לקבוע את ההדרכה לשבוע הבא?",
  "Pilot staff are trained before the cut-over, so tills keep running.":
    "עובדי הפיילוט מודרכים לפני המעבר, כך שהקופות ממשיכות לעבוד.",
  "Book two training sessions per pilot branch next week.": "לקבוע שתי הדרכות לכל סניף פיילוט בשבוע הבא.",
  "Amir, booked: two sessions per pilot branch next week. I'll send the schedule tomorrow. Hila":
    "אמיר, נקבע: שתי הדרכות לכל סניף פיילוט בשבוע הבא. אשלח את הלו״ז מחר. הילה",
  "20 DC workers from Monday at +15%": "20 עובדים למרכז ההפצה מיום שני ב־15%+",
  "Hila, we can supply 20 DC workers from Monday at +15% on the standard rate, for two weeks. Shall we prepare the contract?":
    "הילה, אנחנו יכולים לספק 20 עובדים למרכז ההפצה מיום שני ב־15%+ על התעריף הרגיל, לשבועיים. להכין את החוזה?",
  "The North DC has the people it needs four days sooner.":
    "למרכז ההפצה בצפון יש את האנשים שהוא צריך ארבעה ימים מוקדם יותר.",
  "Prepare a two-week contract and align the start date with Noa.": "להכין חוזה לשבועיים ולתאם את מועד ההתחלה עם נועה.",
  "Tamar, please prepare a two-week contract from Monday. Noa Friedman will confirm the shifts. Hila":
    "תמר, בבקשה הכיני חוזה לשבועיים מיום שני. נועה פרידמן תאשר את המשמרות. הילה",
  "Tamar Ohana": "תמר אוחנה",
  "Account manager, StaffPlus (temp agency)": "מנהלת לקוחות, StaffPlus (חברת השמה)",
  "Recall of batch 4471: final report due in 48 h": "ריקול אצווה 4471: הדוח הסופי בעוד 48 שעות",
  "Ms Barak, please submit the final recall report for batch 4471 within 48 hours, including the quantities recovered per branch.":
    "גב׳ ברק, בבקשה הגישי את הדוח הסופי על ריקול אצווה 4471 תוך 48 שעות, כולל הכמויות שנאספו בכל סניף.",
  "A complete report on time closes the recall with the regulator.": "דוח מלא בזמן סוגר את הריקול מול הרגולטור.",
  "Confirm receipt now and submit tomorrow with Supply Chain's per-branch figures.":
    "לאשר קבלה עכשיו ולהגיש מחר עם הנתונים לפי סניף משרשרת האספקה.",
  "Dr. Barak, thank you. We will submit the final report tomorrow, with the quantities recovered in each of our 60 branches. Yael Barak":
    "ד״ר ברק, תודה. נגיש מחר את הדוח הסופי, עם הכמויות שנאספו בכל אחד מ־60 הסניפים שלנו. יעל ברק",
  "Dr. Nili Barak": "ד״ר נילי ברק",
  "Food-safety regulator, recall unit": "רגולטור בטיחות המזון, יחידת הריקולים",
  "Can we invoke price protection with Dairy Co.?": "אפשר להפעיל הגנת מחיר מול Dairy Co.?",
  "Yael, does our Dairy Co. agreement let us hold the old prices for 30 days on the 7% increase?":
    "יעל, ההסכם שלנו עם Dairy Co. מאפשר לשמור על המחירים הישנים ל־30 יום בהעלאה של 7%?",
  "Eitan can answer the supplier before Friday with a clear legal position.":
    "איתן יכול לענות לספק לפני יום שישי עם עמדה משפטית ברורה.",
  "Confirm the 30-day clause applies and send Eitan the wording.": "לאשר שסעיף 30 הימים חל ולשלוח לאיתן את הנוסח.",
  "Eitan, yes: clause 9.2 gives us 30 days of price protection on notified increases. Wording follows by email. Yael":
    "איתן, כן: סעיף 9.2 נותן לנו 30 יום של הגנת מחיר על העלאות שהודענו עליהן. הנוסח יגיע במייל. יעל",
  "Recall notice templates approved: publish to branches?": "תבניות הודעת ריקול אושרו: לפרסם לסניפים?",
  "Yael, the new recall notice templates are approved by our team. Shall I publish them to all branches today?":
    "יעל, תבניות הודעת הריקול החדשות אושרו בצוות שלנו. לפרסם אותן לכל הסניפים היום?",
  "Every branch has a ready notice for the next recall, in Hebrew and Arabic.":
    "לכל סניף יש הודעה מוכנה לריקול הבא, בעברית ובערבית.",
  "Publish today and ask Store Operations to confirm each branch has them.":
    "לפרסם היום ולבקש מתפעול החנויות לאשר שכל סניף קיבל אותן.",
  "Dafna, yes, publish today, and ask Store Operations to confirm every branch has received them. Yael":
    "דפנה, כן, פרסמי היום, ובקשי מתפעול החנויות לאשר שכל סניף קיבל אותן. יעל",
  "Move the POS cut-over after the holiday?": "לדחות את המעבר לקופות החדשות לאחרי החג?",
  "Amir, the POS cut-over falls inside the holiday peak in all 60 branches. Can we move it after the holiday and pilot in 5 branches first?":
    "אמיר, המעבר לקופות החדשות נופל בתוך שיא החגים בכל 60 הסניפים. נוכל לדחות אותו לאחרי החג ולהתחיל בפיילוט ב־5 סניפים?",
  "No till outage during the busiest weeks of the year.": "בלי השבתת קופות בשבועות העמוסים בשנה.",
  "Move the cut-over after the holiday and pilot in 5 branches.":
    "לדחות את המעבר לאחרי החג ולהתחיל בפיילוט ב־5 סניפים.",
  "Shira, agreed: the 60-branch cut-over moves after the holiday, with a 5-branch pilot first. I'll share dates tomorrow. Amir":
    "שירה, מוסכם: המעבר ב־60 הסניפים נדחה לאחרי החג, עם פיילוט ב־5 סניפים קודם. אשתף תאריכים מחר. אמיר",
  "Wave 3 change order: ₪400k": "הזמנת שינוי לגל 3: ₪400k",
  "Amir, attached is the change order for wave 3 (new payment terminals, ₪400k). We need your signature this week to keep 26 October.":
    "אמיר, מצורפת הזמנת השינוי לגל 3 (מסופי תשלום חדשים, ₪400k). אנחנו צריכים את חתימתך השבוע כדי לשמור על 26 באוקטובר.",
  "Wave 3 keeps its date.": "גל 3 שומר על התאריך.",
  "Ask the vendor to split the order: terminals now, the rest after the holiday.":
    "לבקש מהספק לפצל את ההזמנה: המסופים עכשיו, השאר אחרי החג.",
  "Itay, please split the change order: the terminals now and the rest after the holiday. Finance is reviewing the first part. Amir":
    "איתי, בבקשה פצל את הזמנת השינוי: המסופים עכשיו והשאר אחרי החג. הכספים בודקים את החלק הראשון. אמיר",
  "Itay Ronen": "איתי רונן",
  "Project manager, POS vendor": "מנהל פרויקט, ספק הקופות",
  "Self-checkout firmware fix at Center branches: ETA?": "תיקון קושחה לקופות בשירות עצמי בסניפי המרכז: מתי?",
  "Amir, the self-checkouts in 4 Center branches still freeze at peak hours. When does the firmware fix arrive?":
    "אמיר, הקופות בשירות עצמי ב־4 סניפים במרכז עדיין נתקעות בשעות השיא. מתי מגיע תיקון הקושחה?",
  "Queues at peak hours shorten in 4 Center branches.": "התורים בשעות השיא מתקצרים ב־4 סניפים במרכז.",
  "Give Maya a date and a workaround until then.": "לתת למאיה תאריך ופתרון עוקף עד אז.",
  "Maya, the firmware fix goes out on Tuesday night. Until then, restart the self-checkouts at 16:00 to avoid the freeze. Amir":
    "מאיה, תיקון הקושחה יוצא ביום שלישי בלילה. עד אז, הפעילו מחדש את הקופות בשירות עצמי ב־16:00 כדי למנוע את התקיעה. אמיר",
  "Weekly summary from your team": "סיכום שבועי מהצוות שלך",
  "Hi, here is this week's summary: targets on track, two open items carried to next week.":
    "היי, הנה הסיכום השבועי: היעדים במסלול, שני נושאים פתוחים עוברים לשבוע הבא.",
  "#announcements: holiday office hours": "#announcements: שעות פעילות המשרד בחג",
  "Head office closes at 13:00 on the holiday eve and reopens after the holiday.":
    "המשרד הראשי נסגר ב־13:00 בערב החג ונפתח מחדש אחרי החג.",
  "Office management": "ניהול המשרד",
  "Head office": "המשרד הראשי",
  "Meeting on Tuesday at 10:00?": "פגישה ביום שלישי ב־10:00?",
  "Can we meet on Tuesday at 10:00 to go over next quarter's plan?":
    "נוכל להיפגש ביום שלישי ב־10:00 כדי לעבור על התוכנית לרבעון הבא?",
  "Tuesday at 10:00 works. See you then.": "שלישי ב־10:00 מתאים. נתראה.",
  "Quick question on next week's plan": "שאלה קצרה על התוכנית לשבוע הבא",
  "Do you want the plan in the usual format, or one page this time?":
    "תרצה את התוכנית בפורמט הרגיל, או בעמוד אחד הפעם?",
  "Retail trends this week": "מגמות בקמעונאות השבוע",
  "This week: discount chains keep gaining share; shoppers buy smaller baskets more often.":
    "השבוע: רשתות הדיסקאונט ממשיכות להגדיל את נתחן; הלקוחות קונים סלים קטנים יותר בתדירות גבוהה יותר.",
  "Retail Insights newsletter": "ניוזלטר Retail Insights",
  Newsletter: "ניוזלטר",
  "Expense approval: team workshop": "אישור הוצאה: סדנת צוות",
  "Can you approve ₪2,400 for next month's team workshop?": "תוכל לאשר ₪2,400 לסדנת הצוות בחודש הבא?",
  "Approved. Thanks for organising it.": "מאושר. תודה שארגנת.",
  "Quarterly review moved to Thursday": "הסקירה הרבעונית עברה ליום חמישי",
  "The quarterly review moves to Thursday at 09:00, same room.": "הסקירה הרבעונית עוברת ליום חמישי ב־09:00, באותו חדר.",
  "CEO's office": "לשכת המנכ״לית",
  "Can you join the 15:00 call?": "תוכל להצטרף לשיחה ב־15:00?",
  "We're discussing the holiday weekend at 15:00. Can you join for ten minutes?":
    "אנחנו דנים בסוף שבוע החג ב־15:00. תוכל להצטרף לעשר דקות?",
  "Press clippings: food prices": "קטעי עיתונות: מחירי המזון",
  "Today's coverage: food prices fell for the second month; analysts expect discount chains to keep growing.":
    "הסיקור היום: מחירי המזון ירדו זה החודש השני; אנליסטים צופים שרשתות הדיסקאונט ימשיכו לצמוח.",
  "Communications team": "צוות התקשורת",
  "Interview feedback for the analyst role": "משוב על ראיון לתפקיד האנליסט",
  "Could you send your feedback on yesterday's candidate?": "תוכל לשלוח את המשוב שלך על המועמדת מאתמול?",
  "Strong analytical skills; I'd move her to the final round.": "יכולות אנליטיות חזקות; הייתי מעביר אותה לשלב הסופי.",
  "Reminder: password policy": "תזכורת: מדיניות סיסמאות",
  "Please update your password before the end of the month.": "בבקשה עדכנו את הסיסמה לפני סוף החודש.",
  "IT service desk": "מוקד השירות של IT",
  IT: "IT",
  "Thanks for the support last week": "תודה על התמיכה בשבוע שעבר",
  "Thanks for the support last week, it made a real difference to the team.":
    "תודה על התמיכה בשבוע שעבר, זה עשה הבדל אמיתי לצוות.",
  "you answered last": "ענית אחרון",
  "asks you to choose, approve or commit": "מבקש ממך לבחור, לאשר או להתחייב",
  "a VECTOR decision is waiting for you": "החלטה ב־VECTOR ממתינה לך",
  "urgent, no answer for over 4 h": "דחוף, ללא מענה יותר מ־4 שעות",
  "no answer for over 24 h": "ללא מענה יותר מ־24 שעות",
  "asks you something": "שואל אותך משהו",
  "for your information": "לידיעתך",
  "the VECTOR decision on this sits with you": "ההחלטה על זה ב־VECTOR נמצאת אצלך",
  "needs an answer from you, not a decision": "צריך ממך תשובה, לא החלטה",
  "What if we wait a week?": "מה אם נחכה שבוע?",
  "Nothing measurable is at stake; the thread only waits longer.": "אין כאן סכום מדיד בסיכון; השרשור רק ממתין יותר.",
  "About {m} is lost, and the deadline passes in {d} days, so the option closes.":
    "כ־{m} הולכים לאיבוד, והמועד האחרון עובר בעוד {d} ימים, כך שהאפשרות נסגרת.",
  "About {m} is lost, and the deadline passes tomorrow, so the option closes.":
    "כ־{m} הולכים לאיבוד, והמועד האחרון עובר מחר, כך שהאפשרות נסגרת.",
  "About {m} is lost in that week.": "כ־{m} הולכים לאיבוד באותו שבוע.",
  "Who else is affected?": "על מי עוד זה משפיע?",
  "{list}.": "{list}.",
  "Only the sender and you.": "רק השולח ואת/ה.",
  "What did we do last time?": "מה עשינו בפעם הקודמת?",
  "{title}: {verdict}. Lesson: {lesson}": "{title}: {verdict}. הלקח: {lesson}",
  "not judged": "לא הוערך",
  "No similar decision is on record in VECTOR yet.": "עדיין אין ב־VECTOR החלטה דומה שתועדה.",
  "What does it cost?": "כמה זה עולה?",
  "No cost is attached to this thread.": "לשרשור הזה אין עלות.",
  "{cost}, against {m} a week at stake: it pays back in about {d} days.":
    "{cost}, מול {m} בשבוע בסיכון: ההחזר בתוך כ־{d} ימים.",
  "{cost}.": "{cost}.",
  "Who decides?": "מי מחליט?",
  "You do: {reason}.": "את/ה: {reason}.",
  "{name}: {reason}.": "{name}: {reason}.",
};

export const HE_INBOX_TEMPLATES: Record<string, string> = {
  "{name} asks for your approval": "{name} מבקש/ת את אישורך",
};
