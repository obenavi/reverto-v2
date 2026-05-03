# Reverto v2 — Build Plan

> מסמך תכנון מלא לבניית האפליקציה. כל milestone מסתיים ב-git tag לפני שעוברים לבא.

---

## Vision

Reverto היא פלטפורמת MARKET NETWORK ניהול רכש מבוסס AI וניתוח מידע עיסקי ושיתופי לעסקי מזון, שמשלבת:
1. **כלי ניהול אישי** — סריקת חשבוניות, מעקב מחירי ספקים, ניתוח Food Cost בחישוב ומעקב אחר מחזורי העסק בפיקוח תובנות AI לניהול איכותי שמונע לשם הצלחת העסק והגדלת סיכויי שרידותו אל מול עלויות מחירים תלויות תקופה, חודש, עונה, מקום, מחירוני תקליט ושינויי מחירים בחשבוניות
2. **רשת קהילתית** — נתוני מחירים מצרפיים בין העסקים (אנונימיים ומאובטחים) שחולקים בינהם אך ורק נתוני מחירים למוצרים זהים או דומים
3. **שוק ספקים** — בעתיד: BID לספקים מזדמנים בתחרות מחיר, המערכת מזהה את המחירים וספקים פוטנציאלים ומציעה ללקוח לשלוח את ההזמנה לקבלת BID מספקים מזדמנים -המערכת מזהה את הספקים(שהלקוח לא עובד איתם!) ועשויים להיות מעוניינים לתת הצעה ללא מחוייבות למחיר בהזדמנות הבאה ושעובדים באותו תא שטח של העסק

הערך המרכזי: לקוח רואה כמה הוא משלם, איפה הוא חורג, מה השוק עושה, ואיך לחסוך — בלי לחשוף את עצמו.

---

## Architecture 
[Browser/PWA]
↓
index.html / app.html / onboarding.html
↓ (כל קריאה)
[Netlify Functions]
↓
/auth      — אימות קוד גישה
/db-read   — קריאת נתונים (filtered by user)
/db-write  — כתיבת נתונים (validated)
/ocr       — Azure OCR
/market    — נתוני שוק
/bench     — בנצ'מרק אנונימי
↓
[Supabase Postgres + RLS]
↓
users / suppliers / invoices / invoice_items / market_prices /
daily_revenues / access_codes / community_prices
**עקרון זהב:** הדפדפן לא מדבר עם Supabase ישירות. אף פעם.

---

## Auth System

### סוגי קודי גישה

| סוג | דוגמה | התנהגות |
|-----|-------|---------|
| PILOT | PILOT-001 | קוד אדמין/אישי, חיבור ישיר ל-user קיים, ללא הגבלת זמן |
| REVERTO-3M | REVERTO03 | קוד גנרי לקבוצה — נותן 3 חודשי PRO ליוזר חדש | קלנדריים מיום הרשמה בסיום 3 חודשים השימוש בPRO נחסם ומתאפשר שימוש חינמי בתוכנית הבסיס בלבד
| REVERTO-6M | REVERTO06 | קוד גנרי לקבוצה — נותן 6 חודשי PRO ליוזר חדש | בסיום 6 חודשים קלנדריים מחסם שימוש בPRO ,חינמי נימשך 
| PERSONAL | RV-7K4M2X | קוד אישי שנוצר אחרי onboarding לכל משתמש |לינק זיהוי ואוטנתיות נשלח למייל
### לוגיקת כניסה
POST /.netlify/functions/auth { code }
האם הקוד מתחיל ב-PILOT?
→ טען user מ-DB לפי code
→ החזר user data + JWT session token
האם הקוד מתחיל ב-REVERTO?
→ אל תטען user קיים
→ החזר flag "new_user_signup" + duration_months
→ הלקוח עובר ל-onboarding ויוצר user חדש
האם הקוד מתחיל ב-RV-?
→ טען user לפי personal_code
→ החזר user data + JWT
אחרת — 401
### אחרי Onboarding
- נוצר user חדש ב-Supabase
- נוצר personal_code אישי (למשל RV-7K4M2X)
- מוצג למשתמש: "הקוד האישי שלך: RV-7K4M2X — שמור אותו לכניסות עתידיות"
- ה-personal_code נשמר ב-Supabase ומוצמד ל-user_id

### Session Management
- אחרי כניסה: Netlify מחזירה JWT חתום
- ה-JWT מכיל user_id ו-exp
- כל קריאה ל-Netlify Function שולחת את ה-JWT
- Function מאמתת ושואלת מ-Supabase רק את הנתונים של ה-user_id

---

## Onboarding

### שלב 1 חובה — פרטי עסק
- שם העסק *
- שם פרטי ומשפחה של איש קשר *
- טלפון *
- Email

### שלב 2 חובה — סוג עסק
- מסעדה (איטלקית, אסיאתי, ישראלית, המבורגר, מקסיקני, אחר)
- בית קפה / בייקרי/ סנדוויץ / בר / קייטרינג/ פודטראק / מלון

### שלב 3 חובה — מיקום ופרטי קשר
- ישוב/עיר * (שדה נפרד — לבנצ'מרק גאוגרפי)
- כתובת מלאה

### שלב 4 חובה — תנאי שימוש מלאים
הסכם מקיף שמכסה:
- אחריות לסחורה — בין הספק ללקוח
- אחריות לנכונות הנתונים — על המשתמש
- שמירת פרטיות — Reverto לא חושפת נתוני עסק
- שיתוף נתוני מחירים — מצרפי ואנונימי בלבד
- תשלום ושירותים PRO
- רכיב ה-BID העתידי
- ביטול והפסקת שירות

שלבים 1, 2, 3 חובה למלא.
צ'קבוקס חובה לאישור + צ'קבוקס אופציונלי לקבלת מבצעים.

### שלב 5 —אימות משתמש במייל + לינק סיום הרשמה  + הצגת קוד אישי
- הצגת RV-7K4M2X עם כפתור "העתק"
- הסבר: "זה הקוד שלך לכניסות עתידיות"\בחירת קוד אישי

---

## Database Schema

### `users`
פירטי onboarding עוברים במלואם לתפריט פרופיל העסק.
```sql
id uuid PK
personal_code text UNIQUE  -- RV-XXXX
business_name text
contact_name text
phone text
category text
city text                  -- שדה נפרד מכתובת
address text
email text
plan text DEFAULT 'free'   -- free | pro
pro_until timestamptz
onboarding_done boolean
is_active boolean
created_at timestamptz
```

### `access_codes`
```sql
code text PK              -- PILOT-001, REVERTO03, RV-7K4M2X
type text                 -- pilot | generic | personal
duration_months int       -- 0 לקודים אישיים/PILOT
user_id uuid FK            -- מלא רק לקודים אישיים
is_active boolean
created_at timestamptz
```

### `suppliers`
```sql
id uuid PK
user_id uuid FK
name text
phone text
contact_name text
products jsonb              -- מערך מוצרים עם מחירים
service_areas text[]        -- ערים שבהן הספק פועל
total_amount numeric
invoice_count int
last_invoice_date date
created_at timestamptz
```

### `invoices`
```sql
id uuid PK
user_id uuid FK
supplier_name text
date date
invoice_number text
total_amount numeric
items jsonb
is_credit_note boolean
created_at timestamptz
```

### `invoice_items`
```sql
id uuid PK
user_id uuid FK
invoice_id uuid FK
supplier_name text
product_name text
quantity numeric
unit_price numeric
total_price numeric
date date
```

### `daily_revenues`
```sql
id uuid PK
user_id uuid FK
date date
amount numeric
UNIQUE(user_id, date)
```

### `market_prices` (קיים)
```sql
id, name, price, unit, date, updated_at
```

### `community_prices` (אגרגציה אנונימית)
```sql
id uuid PK
product_name text          -- מנורמל
unit text
avg_price numeric
median_price numeric
sample_count int
city text                  -- אופציונלי לבנצ'מרק גאוגרפי
category text              -- סוג עסק
period text                -- 2026-04 וכו'
-- אין user_id, אין business_name, אין שום זיהוי
```

### Row Level Security
```sql
-- דוגמה ל-suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own suppliers" ON suppliers
  USING (user_id = auth.uid());
```

---

## Netlify Functions

### `/auth.js`
- מקבל code
- בודק סוג קוד
- מחזיר session JWT + user data (או signup flag)

### `/db-read.js`
- מאמת JWT
- מקבל: { table, filter }
- מבצע query ב-Supabase עם filter user_id = jwt.user_id
- מחזיר נתונים

### `/db-write.js`
- מאמת JWT
- מקבל: { table, action, data }
- מוודא ש-data.user_id === jwt.user_id
- מבצע insert/update/delete

### `/ocr.js` (קיים — שיפור)
- מאמת JWT
- מבצע OCR דרך Azure
- מחזיר תוצאות

### `/market.js`
- ציבורי (אין auth)
- מחזיר רשימת מחירי שוק עדכניים

### `/community-bench.js`
- מאמת JWT
- מקבל: סוג עסק + עיר
- מחזיר נתונים מצרפיים מ-community_prices
- ללא חשיפת זהות

### `/aggregate-community.js` (cron job)
- רץ פעם ביום
- אוסף מ-invoice_items של כל המשתמשים
- בונה מחירים מצרפיים ב-community_prices
- ללא user_id, ללא business_name

---

## Market Prices Auto-Update

### בעיה ידועה
ניסיונות קודמים לסקרייפ נכשלו. לא היה fallback, לא הייתה התראה על כשלון.

### גישה חדשה — Multi-source עם fallback
1. GitHub Actions רץ כל יום בשעה 06:00
2. מנסה לסקרייפ מ-3 מקורות שונים:
   - plants.moonsite.co.il (קיים)
   - mash.gov.il (תקליט רשמי)
   - שרק.org אם אפשרי
3. כל הצלחה — דוחפת ל-Supabase
4. כל כשלון — שולחת מייל אזהרה לאדמין
5. אם כל המקורות נכשלו 3 ימים ברצף — התראה דחופה

### מבנה GitHub Action
```yaml
schedule: cron 0 6 * * *
- run: python scrapers/source1.py || python scrapers/source2.py
- on-failure: send-alert-email
```

---

## Security & Privacy

### הסתרת מפתחות
- כל מפתח Supabase + Azure ב-Netlify Environment Variables
- אין מפתחות בקוד הלקוח
- כל קריאה לדאטה דרך Netlify Function

### Row Level Security
- מופעל על כל טבלה עם user_id
- Policy: רק היוזר רואה את הנתונים שלו

### פרטיות נתונים שיתופיים
- טבלה נפרדת community_prices — אגרגציה בלבד
- ללא user_id, ללא business_name
- Cron job עושה אגרגציה מנותקת
- דרישה מינימלית: 5 עסקים תרמו לפני שמציגים נתון

### הגנה מפני פריצה
- JWT חתום (Netlify מבצע)
- Rate limiting על auth endpoint (10 ניסיונות לדקה)
- Headers: HSTS, CSP, X-Frame-Options
- HTTPS חובה (Netlify default)

### GDPR-ready
- כפתור "מחיקת חשבון" שמוחק את כל הנתונים של היוזר
- Export נתונים אישיים לפי בקשה
- Privacy policy מקושרת מהאונבורדינג

---

## Milestones

### M1 — Foundation ✅ הושלם
- מבנה קבצים
- Netlify deploy
- Supabase connected
- CSS design system
- Auth + Onboarding בסיסי

**Tag:** `v2-m1-done`

### M2 — Initial Onboarding ✅ הושלם
- Onboarding 4 שלבים
- שמירה ל-Supabase
- תנאים בסיסיים

**Tag:** `v2-m2-done`

### M3 — Security Foundation 🔄 בעבודה
1. יצירת Netlify Function /db-read ו-/db-write
2. החלפת כל הקריאות הישירות ל-Supabase ב-Functions
3. הוספת JWT session
4. הסרת SUPABASE_KEY מצד הלקוח
5. הפעלת RLS על כל הטבלאות

**Tag:** `v2-m3-security`

### M4 — Auth Refactor
1. תיקון Auth Function — הפרדת PILOT / REVERTO / RV
2. יצירת personal_code אחרי onboarding
3. מסך "הקוד האישי שלך"

**Tag:** `v2-m4-auth`

### M5 — Onboarding שיפור
1. הוספת ישוב/עיר נפרד
2. תנאי שימוש מלאים (משפטיים)
3. שמירת marketing consent

**Tag:** `v2-m5-onboarding`

### M6 — Dashboard
1. כרטיסי stats
2. גרף משולב (רכש + מחזור + Food Cost)
3. AI insights button (locked לחינמי)
4. PRO badge + GO PRO modal

**Tag:** `v2-m6-dashboard`

### M7 — Scanner
1. OCR דרך Function
2. שמירה ל-Supabase
3. WhatsApp prompt

**Tag:** `v2-m7-scanner`

### M8 — Suppliers
1. רשימה + פרופיל
2. היסטוריית מחירים
3. אזורי שירות

**Tag:** `v2-m8-suppliers`

### M9 — Market + Community
1. מחירי תקליט
2. עדכון אוטומטי GitHub Actions
3. בנצ'מרק קהילתי אנונימי

**Tag:** `v2-m9-market`

### M10 — PRO Features
1. הזנת מחזור יומי
2. Food Cost
3. AI insights פעיל
4. תזכורות יומיות

**Tag:** `v2-m10-pro`

### M11 — Admin Panel
1. KPIs
2. ניהול לקוחות
3. ניהול קודים
4. Export

**Tag:** `v2-m11-admin`

---

## Open Items

1. **תנאי שימוש מלאים** — נדרש ניסוח משפטי מקצועי
2. **מינימום עסקים לבנצ'מרק** — האם 5 מספיק או צריך יותר
3. **תשלום** — איזו מערכת (Stripe / Tranzilla / אחר)
4. **עדכון תקליט** — אילו 3 מקורות עיקריים
5. **BID feature** — תכנון מפורט בעתיד