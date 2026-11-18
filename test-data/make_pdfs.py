"""
Generates the sample PDFs used for testing and the demo (fictional organizations).
  pip install reportlab
  python make_pdfs.py
"""
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
import os

ST = getSampleStyleSheet()


def build(path, title, pages):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    story = []
    for i, (heading, paras) in enumerate(pages):
        if i == 0:
            story.append(Paragraph(title, ST["Title"]))
        story.append(Paragraph(heading, ST["Heading2"]))
        for p in paras:
            story.append(Paragraph(p, ST["BodyText"]))
            story.append(Spacer(1, 6))
        if i < len(pages) - 1:
            story.append(PageBreak())
    SimpleDocTemplate(path, pagesize=A4, title=title).build(story)
    print("wrote", path)


A = "org-a-university"
B = "org-b-company"

# ---------------- Organization A: Northfield University ----------------

build(f"{A}/Scholarship_Rules.pdf", "Northfield University: Scholarship Rules 2026-27", [
    ("1. Overview", [
        "This document sets out the rules for all scholarships offered by Northfield University for the academic year 2026-27. Scholarships are administered by the Office of Student Financial Aid (OSFA).",
        "Three scholarships are offered: the Merit Scholarship, the Need-Based Grant and the Sports Scholarship. Amounts are credited directly against tuition fees each semester.",
    ]),
    ("2. Merit Scholarship", [
        "Amount: 50% tuition fee waiver, renewed each year if conditions continue to be met.",
        "Eligibility: The Merit Scholarship is open to students in their 2nd, 3rd or 4th year of an undergraduate programme. First-year students are not eligible because they do not yet have a university CGPA.",
        "Academic requirement: A minimum cumulative CGPA of 8.0 on a 10-point scale at the end of the previous academic year.",
        "Disciplinary record: The student must have no disciplinary action recorded in the previous 12 months.",
    ]),
    ("3. Combining scholarships", [
        "A student may hold only one university-funded scholarship at a time. A student who already holds a Sports Scholarship cannot receive the Merit Scholarship in the same academic year. Such a student may choose to give up the Sports Scholarship and apply for the Merit Scholarship instead.",
        "The Need-Based Grant is the only award that may be combined with either the Merit Scholarship or the Sports Scholarship.",
        "External scholarships from government or private bodies do not count towards this limit.",
    ]),
    ("4. Need-Based Grant and Application Procedure", [
        "Need-Based Grant: open to students in any year whose total annual family income is below Rs 6,00,000. Amount: Rs 40,000 per year.",
        "How to apply: (1) Log in to the student portal and open Financial Aid. (2) Fill in Form SF-2 for the Merit Scholarship or Form NG-1 for the Need-Based Grant. (3) Upload your latest grade sheet and, for the grant, an income certificate issued within the last 6 months. (4) Submit before the deadline.",
        "Deadline: Applications for 2026-27 close on 15 August 2026. Late applications are not accepted. Results are announced by 30 September 2026.",
        "Questions: contact OSFA at the Administration Block, Room 104, open Monday to Friday, 9:30 AM to 4:30 PM.",
    ]),
])

build(f"{A}/Hostel_Policy.pdf", "Northfield University: Hostel Accommodation Policy", [
    ("1. Who can apply", [
        "Hostel rooms are available to full-time undergraduate and postgraduate students whose permanent home address is more than 50 km from the campus.",
        "First-year students are given priority. Students in later years are allotted rooms in order of their CGPA, highest first, subject to availability.",
        "Students with a disciplinary action in the previous 12 months are not eligible for hostel accommodation.",
    ]),
    ("2. Room types and fees", [
        "Single room: Rs 90,000 per year. Double sharing: Rs 65,000 per year. Triple sharing: Rs 48,000 per year. Fees include electricity and Wi-Fi; the mess (meals) is charged separately at Rs 36,000 per year.",
        "Single rooms are reserved for final-year students and students with a documented medical need.",
        "A refundable security deposit of Rs 10,000 is payable at the time of allotment.",
    ]),
    ("3. Rules", [
        "Curfew: residents must be inside the hostel by 10:00 PM on weekdays and 11:00 PM on weekends. Late entry requires prior permission from the warden.",
        "Guests are allowed in the common visitors' room only, between 4:00 PM and 7:00 PM. Overnight guests are not permitted.",
        "Cooking appliances such as induction stoves and electric kettles are not allowed in rooms.",
    ]),
    ("4. Leaving the hostel", [
        "Residents who vacate before the end of the academic year must give 30 days' written notice to the warden. Fees for the remaining full months are refunded, minus a Rs 5,000 processing charge.",
        "The security deposit is refunded within 45 days of vacating, after a room inspection.",
    ]),
])

build(f"{A}/Exam_and_Attendance_Rules.pdf", "Northfield University: Examination and Attendance Rules", [
    ("1. Attendance", [
        "Students must attend at least 75% of classes in each course to be allowed to sit the end-semester examination for that course.",
        "Students with attendance between 65% and 75% may apply for condonation with a medical certificate or proof of representing the university at an official event. Condonation is decided by the Head of Department.",
        "Students below 65% attendance in a course are not allowed to sit the examination and must repeat the course.",
    ]),
    ("2. Grading", [
        "Courses are graded on a 10-point scale: O = 10, A+ = 9, A = 8, B+ = 7, B = 6, C = 5, F = 0. A grade of F means the course must be cleared in a supplementary examination.",
        "CGPA is the credit-weighted average of grade points across all completed semesters.",
    ]),
    ("3. Supplementary examinations and revaluation", [
        "Supplementary examinations are held in July. Students may take at most three supplementary examinations in one session. The fee is Rs 1,500 per course.",
        "Revaluation of an answer script can be requested within 10 days of results being published. The fee is Rs 800 per course and is refunded if the grade improves.",
    ]),
])

# ---------------- Organization B: Brightline Technologies ----------------

build(f"{B}/Leave_Policy.pdf", "Brightline Technologies: Leave Policy (India)", [
    ("1. Leave types", [
        "Earned Leave: 18 days per calendar year, accrued at 1.5 days per month. Up to 10 unused days can be carried forward to the next year; the rest lapse on 31 December.",
        "Sick Leave: 10 days per year. Sick leave of more than 2 consecutive days requires a medical certificate.",
        "Casual Leave: 6 days per year, maximum 2 days at a time. Casual leave cannot be combined with earned leave.",
    ]),
    ("2. Eligibility and approval", [
        "Employees become eligible for earned leave after completing their 3-month probation. During probation only sick leave and casual leave may be taken.",
        "Leave of up to 3 days must be applied for at least 2 working days in advance. Leave of more than 3 days must be applied for at least 2 weeks in advance and approved by the reporting manager.",
        "Leave of more than 10 consecutive working days also requires approval from the department head.",
    ]),
    ("3. Parental leave", [
        "Maternity leave: 26 weeks of paid leave for employees who have worked at least 80 days in the 12 months before the expected delivery date.",
        "Paternity leave: 10 working days of paid leave, to be taken within 3 months of the child's birth or adoption.",
    ]),
])

build(f"{B}/Travel_and_Expense_Policy.pdf", "Brightline Technologies: Travel and Expense Policy", [
    ("1. Approval", [
        "All business travel must be approved in advance by the reporting manager. International travel also requires approval from the Finance Director.",
        "Bookings must be made through the company travel desk at least 7 days before travel, except in emergencies approved by the manager.",
    ]),
    ("2. Travel class and limits", [
        "Flights: economy class for all employees. Business class is allowed only for international flights longer than 8 hours, for employees at level L5 and above.",
        "Hotels: up to Rs 6,000 per night in metro cities (Delhi NCR, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata, Pune) and up to Rs 4,000 per night elsewhere.",
        "Daily allowance for meals: Rs 1,200 per day for domestic travel.",
    ]),
    ("3. Claims", [
        "Expense claims must be submitted in the expense portal within 30 days of returning, with original receipts for every item above Rs 500. Claims submitted after 30 days are not reimbursed.",
        "Alcohol, personal entertainment and traffic fines are never reimbursed.",
        "Approved claims are paid with the next monthly salary.",
    ]),
])

build(f"{B}/Remote_Work_Policy.pdf", "Brightline Technologies: Hybrid and Remote Work Policy", [
    ("1. Hybrid work", [
        "Brightline follows a hybrid model: employees work from the office at least 3 days a week, with Tuesday and Thursday as mandatory office days for all teams.",
        "Employees still on probation must work from the office 5 days a week.",
    ]),
    ("2. Full remote work", [
        "Full remote work may be approved for employees who have completed at least 12 months with the company and received a performance rating of 'Meets Expectations' or higher in the last review cycle.",
        "Full remote requests are approved by the reporting manager and HR and are reviewed every 6 months.",
        "Employees working fully remotely receive a one-time home office allowance of Rs 15,000 and an internet allowance of Rs 1,000 per month.",
    ]),
    ("3. Working from another country", [
        "Working from outside India is not permitted for more than 30 days in a calendar year, and requires prior approval from HR for tax and compliance reasons.",
    ]),
])

# ---------------- Invalid files for testing upload errors ----------------
from reportlab.pdfgen import canvas
os.makedirs("invalid", exist_ok=True)
c = canvas.Canvas("invalid/Too_Many_Pages_25.pdf", pagesize=A4)
for i in range(25):
    c.drawString(72, 800, f"Page {i + 1} of a long document used to test the 20-page limit.")
    c.showPage()
c.save()
with open("invalid/Not_A_Real_PDF.pdf", "w") as f:
    f.write("This is a plain text file renamed to .pdf to test validation.\n")
print("wrote invalid test files")
