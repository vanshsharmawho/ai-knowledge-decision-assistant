# Test questions

Two fictional organizations, each with its own PDFs:

| Organization | Documents |
|---|---|
| **Northfield University** (Org A) | `Scholarship_Rules.pdf` (4 pages), `Hostel_Policy.pdf` (4 pages), `Exam_and_Attendance_Rules.pdf` (3 pages) |
| **Brightline Technologies** (Org B) | `Leave_Policy.pdf` (3 pages), `Travel_and_Expense_Policy.pdf` (3 pages), `Remote_Work_Policy.pdf` (3 pages) |

`npm run seed` (in `server/`) creates both organizations and uploads these files.

## Northfield University (ask on Org A's assistant)

| # | Type | Question | Expected answer | Source |
|---|---|---|---|---|
| A1 | Direct info | When is the scholarship application deadline? | 15 August 2026; late applications not accepted; results by 30 September 2026 | Scholarship_Rules.pdf, p.4 |
| A2 | Procedural | How do I apply for the Need-Based Grant? | Student portal → Financial Aid → Form NG-1 → upload grade sheet and income certificate (≤ 6 months old) → submit before deadline | Scholarship_Rules.pdf, p.4 |
| A3 | Policy | Can I keep an electric kettle in my hostel room? | No, cooking appliances incl. electric kettles are not allowed | Hostel_Policy.pdf, p.3 |
| A4 | **Multi-condition decision** | I'm in 2nd year with a CGPA of 8.2 and I already have a sports scholarship. Can I get the merit scholarship? | **Not eligible.** C1 year ✅, C2 CGPA 8.2 ≥ 8.0 ✅ (rule engine), C3 already holds Sports Scholarship ❌ (only one university scholarship at a time; may give up the sports one) | Scholarship_Rules.pdf, p.2–3 |
| A5 | **Multi-condition decision** | I'm in 3rd year with 8.5 CGPA, no scholarship and no disciplinary record. Am I eligible for the merit scholarship? | **Eligible.** Year ✅, CGPA ✅, no other scholarship ✅, no disciplinary action ✅ | Scholarship_Rules.pdf, p.2–3 |
| A6 | **Multi-condition decision (numeric fail)** | I'm a 4th year student with 7.6 CGPA. Can I apply for the merit scholarship? | **Not eligible.** CGPA 7.6 < 8.0 ❌ (rule engine) | Scholarship_Rules.pdf, p.2 |
| A7 | **Decision with missing info** | I'm in 2nd year. Can I get the merit scholarship? | **Needs review / can't be fully decided.** CGPA and disciplinary record not given | Scholarship_Rules.pdf, p.2 |
| A8 | **Multi-condition decision** | My attendance in Physics is 70% and I have a medical certificate. Can I sit the end-semester exam? | Not automatic: below 75%, but 65–75% with a medical certificate can apply for **condonation**, decided by the Head of Department | Exam_and_Attendance_Rules.pdf, p.1 |
| A9 | Comparison | What is the difference between a single room and a double sharing room? | Single Rs 90,000/yr, only final-year or medical need; double Rs 65,000/yr; mess Rs 36,000 extra for both | Hostel_Policy.pdf, p.2 |
| A10 | Choice decision | My family income is Rs 4,50,000 a year and I'm in 1st year. Which scholarship can I apply for? | Need-Based Grant (income < Rs 6,00,000, any year); not Merit (1st year not eligible) | Scholarship_Rules.pdf, p.2, p.4 |
| A11 | **Not in documents** | What is the fee for the MBA programme? | "I couldn't find this in Northfield University's documents…" (no made-up answer) | none |
| A12 | Summary | Summarise these documents in 2 lines | Short summary covering scholarships, hostel and exam/attendance rules | Opening pages of each PDF |

## Brightline Technologies (ask on Org B's assistant)

| # | Type | Question | Expected answer | Source |
|---|---|---|---|---|
| B1 | Direct info | How many earned leave days do I get per year? | 18 days (1.5/month); up to 10 carry forward | Leave_Policy.pdf, p.1 |
| B2 | **Multi-condition decision** | I joined 8 months ago and my last rating was Exceeds Expectations. Can I work fully remote? | **Not eligible.** Rating ✅, but needs ≥ 12 months ❌ (rule engine: 8 < 12) | Remote_Work_Policy.pdf, p.2 |
| B3 | **Multi-condition decision** | I'm on probation. Can I take 3 days of earned leave next week? | **No.** Earned leave only after the 3-month probation | Leave_Policy.pdf, p.2 |
| B4 | Policy | Can I claim an expense 45 days after my trip? | No, claims after 30 days are not reimbursed | Travel_and_Expense_Policy.pdf, p.3 |
| B5 | **Multi-condition decision** | I'm level L4 flying to New York (16 hours). Can I book business class? | **No.** Flight > 8 hours ✅ but requires level L5+ ❌ | Travel_and_Expense_Policy.pdf, p.2 |
| B6 | **Not in documents** | What is the company's stock price? | Not in the knowledge base | none |

## Isolation check (the most important one)

Ask Org A's (university) assistant: **"How many earned leave days do I get per year?"**

Expected: *"I couldn't find this in Northfield University's documents…"*, even though the answer (18 days) exists in Brightline's documents. Each assistant only sees its own organization's chunks.

`npm run test:isolation` checks this automatically, along with the API-level checks (see README → Tenant isolation).

## Upload error checks (`test-data/invalid/`)

| File | Expected error |
|---|---|
| `Too_Many_Pages_25.pdf` | "This PDF has 25 pages. The maximum is 20 pages per PDF." |
| `Not_A_Real_PDF.pdf` | "This file is not a valid PDF." |
| 11th upload for one organization | "You can have at most 10 documents. Delete or replace one first." |
| Any file over 10 MB | "File is too large. Maximum size is 10 MB per PDF." |
