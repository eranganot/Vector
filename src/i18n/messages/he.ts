/**
 * Hebrew UI strings, keyed by the English source text (see ../t.ts). Placeholders ({n}, {name}) are kept as-is.
 * Arrows that mean "go on" point the RTL way (←). Product names (VECTOR) and band codes (P1, O2) stay Latin.
 */
import { HE_SCREENS } from "./he-screens";

export const HE: Record<string, string> = {
  ...HE_SCREENS,
  // Shell
  Home: "בית",
  Risks: "סיכונים",
  Opportunities: "הזדמנויות",
  Commitments: "התחייבויות",
  "Actions & outcomes": "פעולות ותוצאות",
  Organization: "ארגון",
  "Waiting on you": "ממתין לך",
  Audit: "ביקורת",
  "Demo controls": "בקרת הדגמה",
  "Synthetic organization. Executions are simulated.": "ארגון סינתטי. הביצועים מדומים.",
  "demo clock": "שעון הדגמה",
  "Demo clock": "שעון הדגמה",
  "Viewing as": "צופה בתור",
  demo: "הדגמה",
  "Switch persona (demo)": "החלפת דמות (הדגמה)",
  "Leadership & admin": "הנהלה וניהול מערכת",
  "Regions & branches": "אזורים וסניפים",
  Departments: "מחלקות",
  "Sign out": "התנתקות",
  Main: "ניווט ראשי",
  "Main (mobile)": "ניווט ראשי (נייד)",
  // Sign in
  "Signal → Insight → Decision → Action → Outcome": "אות ← תובנה ← החלטה ← פעולה ← תוצאה",
  "Sign in": "כניסה",
  Email: "דוא״ל",
  Password: "סיסמה",
  "Demo personas": "דמויות להדגמה",
  "Synthetic organization. Signing in as a persona is recorded in the audit trail.":
    "ארגון סינתטי. כניסה בתור דמות נרשמת ביומן הביקורת.",
  "Email or password is incorrect": "הדוא״ל או הסיסמה שגויים",
  "Persona switching is off in this environment": "החלפת דמויות כבויה בסביבה זו",
  "Unknown persona": "דמות לא מוכרת",
  "Persona sign-in failed: check SEED_USER_PASSWORD": "הכניסה בתור דמות נכשלה: בדקו את SEED_USER_PASSWORD",
};
