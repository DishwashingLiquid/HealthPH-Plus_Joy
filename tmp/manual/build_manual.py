from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'tmp/manual'
OUT = ROOT / 'output/manual'
OUT.mkdir(parents=True, exist_ok=True)
DOC = Document()
sec = DOC.sections[0]
sec.page_width, sec.page_height = Inches(8.27), Inches(11.69)
sec.top_margin, sec.bottom_margin = Inches(.68), Inches(.65)
sec.left_margin = sec.right_margin = Inches(.72)
sec.header_distance = sec.footer_distance = Inches(.28)
styles = DOC.styles
for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'Caption', 'List Number', 'List Bullet']:
    s=styles[name]
    s.font.name='Calibri'
    s.font.color.rgb=RGBColor(0,0,0)
    s.font.size=Pt(11)
    s.paragraph_format.space_after=Pt(6)
    s.paragraph_format.line_spacing=1.08
styles['Title'].font.size=Pt(28)
styles['Title'].font.bold=True
styles['Subtitle'].font.size=Pt(14)
styles['Heading 1'].font.size=Pt(20)
styles['Heading 1'].paragraph_format.space_after=Pt(12)
styles['Heading 2'].font.size=Pt(13)
styles['Heading 2'].paragraph_format.space_before=Pt(10)
styles['Heading 2'].paragraph_format.space_after=Pt(5)
styles['Caption'].font.size=Pt(9)
styles['Caption'].font.italic=False
styles['Normal'].paragraph_format.widow_control=True
styles['List Bullet'].paragraph_format.space_after=Pt(4)
styles['List Number'].paragraph_format.space_after=Pt(4)
DOC.core_properties.title='HealthPH Plus Administrator User Manual'
DOC.core_properties.subject='Website operation and collaboration testing'
DOC.core_properties.author='HealthPH Plus'
DOC.core_properties.keywords='administrator, manual, website, collaboration testing'
lang=OxmlElement('w:lang'); lang.set(qn('w:val'),'en-PH')
styles['Normal'].element.get_or_add_rPr().append(lang)
footer=sec.footer.paragraphs[0]
footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('HealthPH+  |  Administrator manual  |  Version 1.0  |  ').font.size=Pt(8)
field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); footer._p.append(field)
pages=[]
fig=0

def p(text, boldlead=None, style=None):
    para=DOC.add_paragraph(style=style)
    if boldlead:
        para.add_run(boldlead+' ').bold=True
    para.add_run(text)
    return para

def h(text):
    return DOC.add_heading(text,2)

def bullets(items):
    for x in items:p(x,style='List Bullet')

def steps(items):
    # Explicit task numbering restarts for each procedure.
    for i,x in enumerate(items,1):
        para=p(f'{i}.  {x}')
        para.paragraph_format.left_indent=Inches(.18)
        para.paragraph_format.first_line_indent=Inches(-.18)
        para.paragraph_format.space_after=Pt(5)

def table(headers,rows,widths=None):
    t=DOC.add_table(rows=1,cols=len(headers))
    t.alignment=WD_TABLE_ALIGNMENT.CENTER
    t.autofit=False
    if widths:
        for col,w in zip(t.columns,widths):col.width=Inches(w)
    for i,txt in enumerate(headers):t.rows[0].cells[i].text=txt
    for row in rows:
        cells=t.add_row().cells
        for cell,txt in zip(cells,row):cell.text=str(txt)
    for ri,row in enumerate(t.rows):
        if ri==0:
            repeat=OxmlElement('w:tblHeader');row._tr.get_or_add_trPr().append(repeat)
        avoid=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(avoid)
        for ci,cell in enumerate(row.cells):
            if widths:cell.width=Inches(widths[ci])
            cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pr=cell._tc.get_or_add_tcPr()
            border=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                el=OxmlElement('w:'+edge); el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D9D9D9');border.append(el)
            pr.append(border)
            mar=OxmlElement('w:tcMar')
            for edge in ['top','left','bottom','right']:
                el=OxmlElement('w:'+edge);el.set(qn('w:w'),'90');el.set(qn('w:type'),'dxa');mar.append(el)
            pr.append(mar)
            shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E8EDF2' if ri==0 else ('F6F8FA' if ri%2==0 else 'FFFFFF'));pr.append(shade)
            for para in cell.paragraphs:
                para.paragraph_format.space_after=Pt(2)
                para.paragraph_format.space_before=Pt(2)
                for r in para.runs:r.font.size=Pt(10);r.bold=ri==0
    p('').paragraph_format.space_after=Pt(0)
    return t

def page(title):
    if pages:DOC.add_page_break()
    number=len(pages)+1
    pages.append({'page':number,'title':title})
    para=DOC.add_heading(title,1)
    start=OxmlElement('w:bookmarkStart');start.set(qn('w:id'),str(number));start.set(qn('w:name'),f'page_{number}');para._p.insert(0,start)
    end=OxmlElement('w:bookmarkEnd');end.set(qn('w:id'),str(number));para._p.append(end)

def shot(name,caption,crop=None,max_height=3.1):
    global fig
    path=WORK/'screenshots'/f'{name}.png'
    im=Image.open(path)
    # Exclude browser tabs, account identity, taskbar, and unrelated windows.
    crop=crop or (270,154,1515,940)
    im=im.crop(crop)
    dest=WORK/'screenshots'/f'{name}-manual.png';im.save(dest)
    w=min(6.75,max_height*im.width/im.height)
    para=DOC.add_paragraph();para.paragraph_format.keep_with_next=True
    para.add_run().add_picture(str(dest),width=Inches(w))
    inline=para._p.xpath('.//wp:docPr')[0];inline.set('descr',caption)
    fig+=1
    p(f'Figure {fig}. {caption}',style='Caption')

page('HealthPH Plus Administrator User Manual')
# Use the Title style for the document title.
DOC.paragraphs[-1].style='Title'
p('Website operation and collaboration testing',style='Subtitle')
p('This manual helps administrators explore the HealthPH+ website, carry out common tasks, and record test results. It explains what each function does, how to use it, and what to check afterward. No programming knowledge is required.')
h('Document details')
table(['Item','Details'],[
('Document version','1.0'),('Issue date','11 November 2026'),('Audience','Website administrators and collaboration testers using an Admin account'),('Website','https://healthph.onrender.com/'),('Sign in','https://healthph.onrender.com/login'),('Purpose','Guided evaluation of website functions and administrator workflows'),('Coverage','Public website checks, administrator modules, account settings, and website exchanges with the mobile system')],[1.45,5.25])
h('How to use this manual')
p('Start with Preparing for testing, then follow the chapter for the task you want to try. Button and tab names follow the website. Expected result describes what you should see; it does not mean the test has already passed.')
p('Screenshots illustrate the website on 11 November 2026. Their numbers and records are examples, not fixed test targets. Some screenshots were captured using a Superadmin session; functions available only to that account type are identified in the text.')
p('The mobile app is outside the instructional scope. References to mobile users explain data received by the website or content, surveys, and alerts made available to mobile recipients.')
p('Review and approval: the collaboration team should record its test outcomes before accepting the website for operational use.')

page('Contents')
toc=DOC.add_paragraph()
p('Select a chapter name in Word or PDF to open that topic. In Word, you may need to hold Ctrl while selecting a link. Page numbers refer to this edition.')
# Populate after all chapters exist.
toc_anchor=DOC.add_paragraph()

page('Preparing for testing')
p('Before you begin, agree with the project coordinator which records, recipients, and accounts may be used for testing.')
h('What you need')
bullets(['The website URL, a working internet connection, and an Admin account with access to the modules being tested.','Access to the email inbox registered to your test account, because sign-in uses an emailed verification code.','A desktop or laptop browser. Screens in this manual were captured in Chrome; confirm other required browsers during testing.','A small sample CSV file, sample content and media, and agreed mobile test recipients for workflows that exchange data with the mobile system.'])
p('Use clearly named records such as TEST Article 01 or TEST Survey 01. Use fictional information in files and forms. Ask the coordinator which test records to keep after the session.')
h('First visit')
steps(['Open https://healthph.onrender.com/. An existing signed-in session may redirect you to the dashboard.','If the public page appears, open Sign In or go to https://healthph.onrender.com/login. Complete the sign-in procedure on the next page.','Confirm the account name and role in the top bar. Expand the navigation menu to see your available modules.','Begin with a viewing task, such as checking the surveillance map. Record the date, filters, and result before moving to tasks that save or publish information.'])
h('Actions with visible effects')
p('Creating accounts sends invitations. Publishing content and surveys can make them visible to recipients. Enabling alerts or checking reports can prepare real alerts. Updating surveys can remove responses. Deletion may remove records used by other views. Carry out these tasks only with the agreed test records and recipients.')
h('Recording a result')
p('Record Pass, Fail, Blocked, or Not applicable. A missing data source or insufficient permission is a reason to investigate, not an automatic pass. Include the exact message and record ID when reporting a problem. A test worksheet is provided near the end of this manual.')

page('Signing in and recovering access')
h('Sign in')
steps(['Open https://healthph.onrender.com/login.','Enter your registered Email and Password, then select the sign-in button.','Open the verification email in your registered inbox. Enter the Verification Code on the website and submit it.','Wait for the dashboard to appear. If you were opening a protected page, the website may return you to that page.'])
p('Expected result: you see the dashboard or another page your account is allowed to open. The top bar shows your account identity.')
h('If the code does not arrive')
p('Check the address you entered, your spam or junk folder, and the website message. Use Resend when its waiting period has finished. Use the latest code you receive. If delivery continues to fail, contact the project coordinator; do not share the code in a test report.')
h('Activate a new account')
steps(['Open the invitation email sent after an administrator creates your account.','Follow its activation link. Create and confirm your own password using the requirements shown on the page.','Submit the activation form. When the account-ready message appears, return to Sign In.'])
p('An invalid or expired invitation needs a new invitation from an authorized administrator. Activation and ordinary password recovery are separate workflows.')
h('Recover a forgotten password')
steps(['Select Forgot Password on the sign-in page. Enter your registered email and submit the request.','Open the password-reset email and follow its link.','Enter and confirm a new password, submit the form, then sign in again.'])
p('Follow the displayed password rules: at least eight characters without spaces, uppercase and lowercase letters, a number, and an allowed special character. Allowed special characters are ! @ # $ % ^ & * _ -.')
h('Sign out')
p('Select the sign-out icon or Log Out option in the top navigation. Confirm the sign-out dialog if it appears. Check that you return to the sign-in or public page before leaving a shared computer.')

page('Finding functions and using common controls')
p('Use the left navigation to choose a module. Select the menu icon to expand or collapse it. Help and Settings are available in the top navigation; the sign-out icon is at the right.')
table(['Module','Main administrator tasks'],[
('AI Surveillance','Filter disease signals, inspect map locations, review symptoms, and print a summary.'),('NLP Insights','Review disease and symptom counts, word frequency, and detected languages.'),('Misinformation Tracker','Check the current availability notice.'),('User Management','Manage permitted user accounts and organizations; review account activity.'),('Model Access & Toolkit','Review model displays, manage source data, and inspect processing history.'),('Disease Watch Feed','Review mobile self-reports, configure regional alerts, and inspect regional coverage.'),('Health Literacy Hub','Create and publish articles, videos, and infographics; moderate website comments and review usage.'),('Sentiment Pulse Tool','Review mobile survey sentiment, compare regions, create surveys, and export results.')],[1.8,4.9])
h('Common controls')
bullets(['Tabs change the view within a module. Search narrows the current list. Clear the search to see the list again.','Filters change the records displayed. Note the date range, region, source, and status before comparing totals. Reset filters returns that view to its defaults.','Previous and Next move between pages. Row checkboxes select records for a group action; review the selected count before confirming.','A greyed-out button is unavailable. Check whether a selection, loaded data, permission, or suitable record status is required.','Cancel closes a form without submitting its changes. Create, Save, Update, Publish, or Confirm applies the action described by the dialog.'])
p('Access note: an Admin role is distinct from the SUPERADMIN account type. Accessible modules and regions depend on your assigned access. Superadmin-only functions, such as managing Superadmins or editing role definitions, are outside ordinary Admin operation.')

page('Using the surveillance map')
p('Open AI Surveillance to review disease signals from processed self-reports and social media data. A map marker is a surveillance signal associated with a location.')
shot('ai-surveillance','AI Surveillance with time, region, and impact filters',max_height=3.55)
h('Filter and inspect a location')
steps(['Choose the time period, region, and impact options at the right of the map.','Wait for the map and summary to finish loading. Read the message showing how many processed entries match.','Use the plus and minus controls to zoom and drag the map to move around it.','Select a red pin. Read its disease signals and available environmental information for the selected period.','Select Reset filters when you want to return to the default view.'])
p('Expected result: the map and summary reflect the selected filters. A location detail view appears when a valid pin is selected.')
p('If no pins appear, first widen the date range and region selection. Only processed entries with supported disease labels can create disease pins. A report may contribute symptoms without creating a disease marker.')

page('Understanding surveillance summaries and printing')
h('Read the summary correctly')
table(['Display','Meaning'],[
('Matching processed entries','Source records included by the current filters.'),('Disease Label Detections','The total of detected disease labels. A single report can receive several labels.'),('TB','Tuberculosis disease label.'),('COVID','COVID-19 disease label.'),('PNEUMONIA','Pneumonia disease label.'),('AURI','Acute upper respiratory infection disease label.'),('Symptom Frequency','Reports containing each selected or extracted symptom. Each report counts once per symptom.'),('Suspected Conditions Percentage','Share of disease label detections, rather than the percentage of people diagnosed.')],[2.0,4.7])
p('Example: one processed report can contain four disease labels. The entry count is one while Disease Label Detections is four. These measures answer different questions.')
h('Print a summary')
steps(['Apply the filters you want to report and wait for the results.','Select Print. Check the preview and the reporting period.','Choose a printer, or choose Save as PDF in the browser print dialog.','Save the file and open it to confirm that the intended map and summary are readable.'])
p('Expected result: a readable report representing the selected surveillance view. If the preview is incomplete, cancel it, allow the data to load, and try again.')
h('Features with unavailable data')
p('Respiratory Monitoring currently states that respiratory rate and cough frequency measurements are not connected. Trend Forecasting states that a forecasting model and prediction data are not connected. Record these as stated feature limitations when evaluating the website.')
p('Interpretation: self-reported symptoms and automated labels are signals for review. They do not establish confirmed diagnoses or an officially declared outbreak.')

page('Reviewing NLP Insights')
p('NLP means natural language processing: automated analysis of text. Open NLP Insights and choose the tab you need.')
shot('nlp-insights','Disease labels, symptom frequency, and submitted regions',crop=(270,154,1515,810),max_height=3.05)
h('Named Entity Recognition')
steps(['Review Diseases, Symptom Frequency, and Locations. Select View all when a panel offers more records.','Review Top Words and the Word Cloud. Hover over a word to see its occurrence count.','Select Print to prepare the current tab summary, then choose a printer or Save as PDF.'])
p('Locations group records by their submitted location region, rather than by every place mentioned in their text. Word occurrences count words; they are different from report counts. The Named Entity Recognition Demo is currently unavailable even though summary panels contain results.')
h('Language Detection')
p('Select Language Detection to review the distribution of English, Filipino, Cebuano, Hiligaynon, and Ilocano results and their regional distribution. Use Print for the tab report. Region unavailable means that a region could not be assigned; it is not a separate geographic region.')
h('Sentiment Analysis')
p('The NLP Insights Sentiment Analysis tab is under development and is not connected to self-reports and social media datasets. Use Sentiment Pulse Tool for the separate mobile survey sentiment workflow.')
p('Expected result: available panels load their source summaries, and unavailable functions display a clear message. Language counts and percentages describe detections; they do not establish model accuracy.')

page('Checking model displays and processing history')
h('Model Comparison')
p('Open Model Access & Toolkit and select Model Comparison. The page displays a model performance chart and model cards with measures such as F1 score, precision, recall, and accuracy.')
p('The current comparison figures are sample display values. Use this screen to evaluate presentation and readability. Do not use these figures as evidence that the deployed models achieved the displayed performance. Model search and selector controls on this display do not establish a completed evaluation workflow.')
table(['Term','Plain language meaning'],[
('Precision','How often a positive prediction is correct in a labelled evaluation.'),('Recall','How many relevant examples the model finds in a labelled evaluation.'),('F1 score','A combined measure of precision and recall.'),('Accuracy','The proportion of correct predictions in a labelled evaluation.')],[1.25,5.45])
h('Training Logs')
steps(['Select Training Logs in Model Access & Toolkit.','Find the dataset and review its run identifier, model or pipeline name, status, start time, and duration.','If the list fails to load, use Retry. If it is empty, confirm that a dataset has been uploaded and processed.'])
p('Expected result: dataset processing history appears. In the current implementation, these rows are derived from dataset processing records; they do not prove that a new model was trained. Export Logs and row action buttons should be treated as unverified controls until a real output is produced.')
h('Misinformation Tracker')
p('Open Misinformation Tracker from the navigation. The current module shows an availability or development notice instead of live misinformation results. There is no completed claim-monitoring workflow to test in this module. Fact-check labels in Health Literacy Hub are a separate content-management function.')

page('Reviewing and processing self reports')
p('Open Model Access & Toolkit, select Data Management, then select Self Reports. These entries come from the mobile reporting workflow.')
shot('data-management','Self Reports source selection and filter controls',crop=(270,154,1515,610),max_height=2.6)
h('Find a report')
steps(['Search for report text or a location, or apply From date, To date, Language, Region, and Status filters.','Open a report row or its details action. Review its report ID, text, submitted location, reporting date, language, and processing status.','Close the details and clear or reset filters when finished.'])
h('Process a report')
steps(['Choose an agreed test report with Submitted or Failed status. Open it and select the available processing action.','For several eligible reports, select their checkboxes and use Process Selected, then review any confirmation.','Wait while the status changes through Queued or Processing. Reopen the record when it is Processed, or read the failure message if it is Failed.','Return to the relevant surveillance or NLP view and check the processed output using matching filters.'])
p('Expected result: the request is accepted and later reaches a final processing status. An accepted request is not the same as completed processing. Processing detects language, disease labels, and symptoms; model availability and the report text affect the results.')
p('Print prepares all records matching the current view filters, rather than just the visible page. Keep report text and submitted locations within the agreed testing group.')

page('Preparing a social media CSV file')
p('Open Model Access & Toolkit, select Data Management, then Social Media Datasets. Select Download Template. Replace its sample rows while keeping the six column names.')
table(['Column','What to enter','Example'],[
('id','An identifier for the source post. Do not leave it blank.','TESTPOST001'),('text','The post text to analyze. Do not leave it blank.','Demo only I have a cough'),('location','The location associated with the source post.','Quezon City NCR'),('date_posted','The original posting date, or timestamp if known.','2026-11-10'),('source','The source platform or label.','Test data'),('date_collected','The date the post was collected.','2026-11-11')],[1.1,3.75,1.85])
h('Date and file rules')
bullets(['Use YYYY-MM-DD, such as 2026-11-10. If a time is known, use an ISO timestamp such as 2026-11-10T09:30:00+08:00.','Avoid slash-form dates such as 10/11/2026. Missing or invalid date values can be rejected with a row and column message.','In Excel, format date cells as yyyy-mm-dd before saving as CSV. Check the exported text if the upload reports a date problem.','Keep commas and line breaks inside text properly quoted by your spreadsheet CSV export. Keep the header row and use one post per row.','Do not add disease classifications as input columns. Disease labels are produced during processing.'])
p('Date meaning: surveillance uses date_posted for a social media post and the creation time of a mobile self-report. Collection, upload, and processing times do not replace the original event date.')
p('For a first test, use a very small file with fictional content and a recognizable test ID. Keep a copy of the exact CSV submitted so that the team can reproduce the result.')

page('Uploading and managing datasets')
h('Upload and process')
steps(['In Data Management, select Social Media Datasets and Upload Dataset. Choose your CSV file.','Check the upload preview, filename, headers, and row count. Cancel if you selected the wrong file.','Confirm the upload. Find the file in the list and open its dataset preview.','Select Process Dataset when the status allows it. For multiple files, select eligible rows and use Process Selected.','Wait for completion. If processing fails, read the message, correct the cause, then use Retry Processing where available.','After successful processing, check the relevant dashboard using the source post dates and regions.'])
table(['Status','What it tells you'],[
('Uploaded','The file is stored and ready for processing.'),('Queued','The request is waiting to run.'),('Processing','Analysis is running. Wait for a final result.'),('Processed','Analysis finished and the dataset is ready for dashboard use.'),('Failed','Processing did not complete. Inspect the error before retrying.')],[1.25,5.45])
h('Search and download')
p('Use the list search and date, language, region, or status controls to find a file. Open the preview to inspect its rows. Select Download for that file, or select files and use the group download action. Open the downloaded file to confirm its contents.')
h('Delete an agreed test dataset')
steps(['Select the intended test dataset or open its preview.','Choose Delete and read the confirmation, including the selected record count.','Confirm only when the coordinator has agreed that the records can be removed. Check that the file disappears and record the outcome.'])
p('Deletion may affect results that depend on the dataset. Keep the original CSV if the test needs to be repeated. Do not assume that a deleted dataset can be restored through the website.')

page('Managing user accounts')
p('Open User Management and select Users. Use search, row selection, and Previous or Next to locate the intended account.')
shot('user-management','Account management tabs and toolbar shown with full administrative access',crop=(270,154,1515,405),max_height=1.55)
p('The Superadmins tab shown in this example is available to Superadmins. An ordinary Admin should use Users and the other tabs granted to that role.')
h('Add a user')
steps(['Select Add User. Confirm that you are creating the intended account type.','Choose the Role, Regional Office, Accessible Regions, and Organization where the form permits those choices.','Enter the First Name, Last Name, and Email. Use the agreed test recipient email.','Submit the creation form and review the result. The recipient activates the account using the invitation email and creates their own password.'])
p('Expected result: the account appears with a pending activation or active status as appropriate. Invitation not sent indicates a delivery problem; creating the database record alone does not prove that an invitation arrived.')
h('Edit and control account status')
steps(['Open the intended account row or details control. Review its identity before editing.','Change the permitted details and save. Confirm the updated values in the list or details.','For pending accounts, use Resend Invitation when available after verifying the email address.','To change access status, select the account checkbox and choose Disable or Enable. Review and confirm the action.'])
p('Disable blocks the account without being the same action as Delete. Delete should be used only for agreed disposable test accounts after reviewing the confirmation. Some actions are unavailable for your current account or for protected accounts.')
p('Use Print to review the current account view in a report. Account names and email addresses should be shared only with the authorized collaboration group.')

page('Managing organizations and reviewing account activity')
h('Organizations')
steps(['In User Management, select Organizations & Roles, then Organizations.','Search for an organization or select Add Organization if your role allows it.','Complete Organization Name, Main Region, Partnership Status, Region Coverage where available, and Description. Save the form.','Open the organization details to inspect its regions and account counts. Use Edit to update permitted fields.','For a disposable test organization, choose Delete only after reading the confirmation and resolving any linked-account restriction.'])
p('Expected result: the saved organization appears in the organization list and its details match the values submitted. An organization referenced by accounts may need those relationships resolved before deletion.')
h('Roles and permissions')
p('Select Roles to review the available role records, status, descriptions, user counts, and page access shown by the website. Editing role definitions is restricted to Superadmins in the current implementation. Ordinary Admin testers should record the available view and ask the coordinator to arrange any permission-change test.')
p('Your role can limit the pages and regions you can use. If a required module is absent or displays Access Denied, report the account role and page name. Sign out and sign back in after an authorized permission change so the session can refresh.')
h('Account Analytics')
steps(['Select Account Analytics. Review total accounts, organizations, roles, and the activity overview.','Where Recent Account Activity is available, use its search and date controls to locate the test action.','Compare the activity record with the action you performed and its time.','Use Print to prepare the permitted view when a report is needed.'])
p('Expected result: loaded totals and activity reflect your permitted scope. An activity entry records a website action; it does not by itself prove delivery of an invitation, alert, or exported file.')

page('Reviewing Disease Watch Feed self reports')
p('Open Disease Watch Feed and select Recent Alerts. The page combines incoming mobile self-reports with regional alert history.')
shot('disease-watch','Recent Alerts with mobile self-reports and the Set Up Alerts control',crop=(270,154,1515,920),max_height=3.1)
h('Review a self report')
steps(['Read the symptom pattern label, reported symptoms, region, and update time on the card.','Use Previous and Next to inspect additional self-reports.','If a regional administrative summary is displayed, review its period and region separately from individual reports.','If the section fails to load, use its Retry control when offered and record the error if it persists.'])
p('Expected result: submitted reports appear with their associated symptoms and regions. Receiving a report in this feed does not establish that all later NLP processing has completed.')
p('Reports and alerts are different records. Creating an alert does not remove the source report. The alert history records the counts and period used when an alert was prepared.')
p('The descriptive cards at the top explain intended uses of the module. They are not proof that notifications were received, read, or sent before an official announcement. Use the actual history and recipient test evidence when evaluating delivery.')

page('Setting up regional alerts')
p('Before saving alert settings, confirm the agreed test region and mobile recipients with the coordinator. These settings can affect subsequent report checks.')
shot('alert-setup','Live Set Up Alerts dialog with threshold and report period',crop=(342,222,1464,895),max_height=3.05)
h('Change alert choices')
steps(['Select Set Up Alerts in Recent Alerts.','Review whether Automatic alerts is On or Off. Change it only as required by the agreed test.','Enter a whole-number threshold greater than zero. A value of 5 means the count must go above 5, so 6 reports can qualify.','Choose How far back should we count reports. In a revised interface this field may be labelled Time period.','Read the explanation and saved settings below the controls. Select Save choices to apply your settings, or Cancel to leave them unchanged.','Reopen the dialog and verify that the saved values are retained.'])
p('Expected result: the choices are saved and the displayed saved settings reflect the values you selected.')
p('Period behaviour: the report period determines how far back a check counts reports and the scheduled checking interval. New reports may also be checked as they arrive. The live dialog currently describes a 24-hour wait for repeating the same symptom in the same region. Follow the explanation shown in your deployed version.')
p('If saved settings are unavailable, retry loading them before proceeding. Saving an alert configuration does not prove that an alert was created or received.')

page('Checking alert history and regional coverage')
h('Check reports and inspect the result')
steps(['In Recent Alerts, review the saved choices and ensure Automatic alerts is enabled for the test.','If Evaluation interval appears beside Check reports now, review its selected period before checking.','Select Check reports now. This may create qualifying alerts for mobile recipients.','Read the completion or error message, then inspect Alert History. Check the region, report count, reporting window, status, and recipient preparation message.'])
p('Expected result: the check completes and history is refreshed. No new alert can be a valid result if there are insufficient eligible reports or repeat-alert waiting rules apply. Read the message rather than assuming that every check creates an alert.')
table(['History information','How to interpret it'],[
('Made automatically','Created by the regional report-checking rules.'),('Prepared or available in app inboxes','Recipient preparation or inbox availability. This does not establish that a device notification arrived or that anyone read the alert.'),('Preparation failed','The alert or recipient preparation encountered an error. Preserve the message for support.'),('Reports counted and period','The counts and time window recorded for that alert, which can differ from today\'s feed.'),('Scheduled and Cancel alert','Where an existing manual scheduled alert offers cancellation, review its scheduled time before using Cancel alert.')],[2.05,4.65])
h('Regional Coverage')
p('Select Regional Coverage. Review the distribution of distinct mobile reporters and the regional cards. Use Filter Regions to narrow the cards, then clear the selection to restore the full view. A reporter count is different from a symptom-report count; one reporter can submit more than one report.')
h('User Analytics')
p('Select User Analytics to review mobile reporter totals, symptom reports, and any available alert-open metric. An unavailable Alert Open Rate is not zero and cannot be inferred from prepared recipients. Compare figures only when their reporting periods and population match.')

page('Finding educational content')
p('Open Health Literacy Hub. Use Articles, Videos, and Infographics for content management, and Analytics for usage information.')
shot('health-literacy','Health Literacy Hub tabs, comment moderation, and content controls',crop=(270,154,1515,875),max_height=3.15)
h('Find and inspect content')
steps(['Select the content type. Enter a title or search term in the list search.','Open the content or media preview. Review the title, description, language, and available attachment or media.','For a video, check playback and the displayed media details. For an infographic, check that the image and text are readable.','Close the preview and use Edit where offered for a record that can be managed in the website.'])
p('Expected result: the selected content type and search show matching records. The preview opens the intended content and any available media.')
p('Articles, videos, and infographics may include website-managed content and older reference items. An item without an Edit control may not be editable through this module. Record the item title and source when reporting this difference.')
p('Community Q&A is a descriptive heading in this module. Do not assume it provides a separate functioning expert-response workflow. Website comment moderation is described later in this manual.')

page('Creating and editing educational content')
h('Create a draft')
steps(['Select Articles, Videos, or Infographics, then Create New Content.','Enter Title and Description. Choose the correct Language; these are required.','Fill in optional Source, Author, Published Date, Tags, Topics, and Diseases as appropriate. Use comma-separated values for the three list fields.','Add the applicable image, attachment, or media link. Scroll within the form to reach the remaining fields.','Leave Publish to mobile and Publish to website unchecked to save a draft.','Select Create. Find the new item in the correct content list and open its preview.'])
p('Expected result: a saved draft exists in the administration list without being published through either selected public channel.')
table(['Field or option','How to use it'],[
('Language','Choose English, Filipino, Cebuano, Ilocano, or Hiligaynon. This identifies language; it does not translate the content.'),('Published Date','Optional displayed publish date. Changing it alone does not replace the channel visibility choices.'),('External URL','A related source or destination link. Check that it opens the intended page.'),('Image URL or Media URL','An externally hosted image or media source where the form supports it.'),('Short preview','If offered for articles, a brief card introduction. It is separate from the full description.'),('Publish to website or mobile','Controls visibility on that channel. Review both choices before saving.')],[1.8,4.9])
h('Edit and publish')
steps(['Open Edit on the agreed test item. Review the existing text and media.','Make changes and choose the intended publication channels.','Select Save. Reopen the item and verify the saved values.','For website publication, check the public page in a signed-out session. For mobile publication, ask the mobile test participant to confirm receipt or visibility.'])
p('Use Delete only for agreed disposable content after reading its confirmation. Deleting content and turning off a publication channel are different actions.')

page('Adding media and reviewing fact check labels')
h('Choose supported files')
table(['Content','File types','Current limits'],[
('Images and infographics','JPG, PNG, GIF, WEBP','25 MiB per image, about 26.2 MB.'),('Video media','MP4, MOV, WEBM','250 MiB per video, about 262 MB.'),('Article PDF attachment','PDF','25 MiB per file, about 26.2 MB.')],[1.65,2.25,2.8])
p('Use the size and format guidance displayed by your form. Select a file through its upload control or drop it into the supported upload area. Inspect the preview before saving. Replacing or removing a file in a form takes effect when the content is saved.')
h('Article images where available')
p('In versions with an Article images section, select Add images. Add captions and image descriptions so readers using screen readers can understand the images. Use Move up or Move down to arrange them, Replace to exchange a file, and Remove to exclude it. Mark an image decorative only when it adds no information.')
p('The gallery supports up to ten images. Newly added images have a combined limit of 75 MiB, about 78.6 MB, per save. Article attachment controls accept one video or PDF separately from the image gallery. Older deployments may instead show a single Article Asset Upload area.')
h('Fact check content')
steps(['Enable the fact-check option only for content intended to document a reviewed claim.','Enter the Claim. Select its status: False, Misleading, Verified, or Needs Expert Review.','Select the appropriate Verified by label and provide a meaningful source in the content.','Save the draft or publish only after the agreed reviewer has checked the claim and attribution.'])
p('Expected result: the saved content retains the claim and review labels. Selecting DOH or Medical Expert is an administrator-supplied attribution; it does not automatically obtain endorsement or professional review.')
p('If media says it requires migration or cannot be previewed, preserve the original record and ask the coordinator to resolve the attachment. A preview problem is not a reason to delete the entire item.')

page('Moderating comments and reviewing content usage')
h('Website comment moderation')
steps(['In Health Literacy Hub, locate Website comment moderation.','Choose Pending to review new submissions, Approved / reported to review visible or reported comments, or Hidden to revisit hidden comments.','Read the comment and its associated content identifier. Select Approve to make an appropriate submission public, Hide to remove it from public display, or Delete for an agreed removal.','Read the result message. Use Previous comments and Next comments to review other pages.'])
p('Expected result: the comment moves to the appropriate status. New submissions require approval before public display. These actions affect website comments; they are separate from the unavailable Misinformation Tracker.')
h('Analytics')
steps(['Select Analytics. Choose Time Range, Content Type, and Region.','Wait for the figures to load. Review Total Content Views, Content Pieces, Engagement Rate, and Top Performing Content.','Read the labels underneath each figure before comparing values.','Use the CSV, image, or report export control offered in the view. Open the resulting file or print preview and verify the selected scope.'])
p('Total Content Views is labelled as views, shares, and downloads, so it is an interaction total rather than a count of unique readers. Content Pieces counts uploaded items. Engagement Rate refers to the user and interaction definition shown by the page. The Misinformation Reports card is marked Future enhancement.')
h('Check the public result')
p('Use a separate signed-out browser session to open the public website and its Articles section. Confirm the test content title, description, language, links, and media. Check that drafts and items with website publication turned off are not exposed by that channel. Keep the Admin session available so you can correct the test record if needed.')
p('A successful save is not a complete publication test. Verify what the intended recipient can actually open.')

page('Filtering Sentiment Pulse results')
p('Open Sentiment Pulse Tool and select Sentiment Trends. This workflow analyzes answers received through mobile surveys.')
shot('sentiment-trends','Sentiment reporting filters and separate sentiment and satisfaction measures',crop=(270,154,1515,940),max_height=3.2)
h('Choose the reporting scope')
steps(['Choose Last 7 Days, Last 30 Days, Last 90 Days, or Custom Range. For a custom range, enter a valid start and end date.','Choose All Regions or select the regions you want to inspect. Remove a selected region using its filter control.','Choose All surveys or a particular survey in the survey selector.','Select Refresh Results and read the reporting-scope line above the results.','Review Overview, the time charts, distribution panels, and Detailed Data.'])
p('Expected result: the report scope and results match the selected dates, regions, and survey. Dates in these reports use Philippine calendar days; today includes only the elapsed part of the day.')
p('The summary cards at the top do not all use the same scope. Sentiment Score follows the Trends filters. Survey Responses shows its displayed published-survey month. Active Regions states its own survey coverage. Read each card subtitle before comparing it with the filtered charts.')

page('Understanding sentiment and regional results')
table(['Measure','What it means'],[
('Calm and Worried','Labels assigned by the sentiment model to analyzed text or choice answers.'),('Sentiment percentage','A class share among analyzed answers. Calm 70% means 7 of 10 analyzed answers were classified Calm.'),('Survey responses','Survey submissions. One submission may contain several answers.'),('Analyzed answers','Eligible answers with completed sentiment results. This is not a unique-person count.'),('Without results','Eligible answers lacking a sentiment result. They are excluded from sentiment percentages.'),('Satisfaction','A separately scored answer measure. It is not the same as Calm sentiment.'),('Unavailable or blank','The value is missing or cannot be calculated. It is not zero.')],[1.75,4.95])
h('Regional Analysis')
steps(['Select Regional Analysis and review its date and region filters.','Refresh Results, then compare regional cards and the comparison display. Use a show-empty-regions option if offered.','Open the explanatory details to review the units and missing-data rules.','Record Unknown region and incomplete-link notices with the result.'])
p('Regional Analysis covers all existing surveys with mobile answers; the Trends survey selector does not restrict it. Regional satisfaction uses the submissions described in that view, which can differ from the Trends calculation. Do not expect the two tabs to have identical percentages.')
p('Missing or conflicting locations appear as Unknown region. Selecting named regions excludes unknown-region answers from that selected view. Some response counts are unavailable when answers cannot be linked to their submission.')
h('Export a result')
steps(['Open the required tab, apply its filters, and wait for data to load.','Select Export as CSV for data or Export as PDF for the report and print workflow.','Open the output. Check its tab, dates, regions, survey scope, units, and totals against the screen.'])
p('Mobile Surveys exports cover whole-survey results across all dates and regions. Use the file\'s scope labels to interpret it. A disabled export control can indicate missing data, a loading request, or a failed request.')

page('Creating a mobile survey from the website')
p('In Sentiment Pulse Tool, select Mobile Surveys. The website creates and manages surveys; mobile participants supply the responses.')
shot('sentiment-surveys','Survey cards showing lifecycle status, results, and processing actions',crop=(270,154,1515,940),max_height=2.7)
h('Create a draft survey')
steps(['Select New Survey. Enter a clear Survey Title, a Description, and a positive Target Responses number.','Add questions using Text, Multiple Choice, or Rating Scale. Enter the question wording.','For Multiple Choice, replace the sample options with meaningful choices. For Rating Scale, set an appropriate minimum and maximum.','Mark questions Required where necessary. Use the move controls to put them in the intended order and remove unused questions.','Select the review or create-draft control. Read the Review Survey preview from the participant\'s perspective.','Use Back to Edit if a correction is needed. Otherwise select Confirm Create Draft when that review step is provided.'])
p('Expected result: a survey card appears with an assigned survey ID and Draft status. Creating a draft does not publish it to mobile users.')
p('The target is a planned response count, not a count already received. Record the survey ID and wording so the mobile test participant can identify the correct survey.')

page('Publishing surveys and checking responses')
h('Schedule publication')
steps(['Select Publish Survey. In Schedule Mobile Surveys, choose the draft survey or surveys.','Set each selected survey\'s Publish Date and Time. Use the agreed Philippine test time and verify the computer timezone.','Review the selected count and select Schedule Selected.','Check the card for its scheduled time and status. At the due time, ask the mobile test participant to confirm that the survey is available.'])
p('Expected result: the survey is scheduled and later published for mobile participants. A saved schedule is not evidence that a participant has received or answered it.')
h('Inspect and process responses')
steps(['After the mobile test participant submits the agreed answers, select Results on the corresponding survey card.','Review Total Responses, Target Responses, completion, and the available question or response results.','Select Process where available to analyze eligible answers that lack results.','Wait for a final result. Processing request accepted means the request started; read the separate completion or error message.','Reopen Results and compare the counts with Sentiment Trends using matching dates and the survey ID.'])
p('A card\'s sentiment summarizes the whole survey across all dates and regions. It may differ from a filtered Trends view. An ended survey may still offer processing for existing answers.')
h('Edit or end a survey')
p('Use Edit when the card allows it. Review the update warning carefully: an update can remove existing responses, reset analytics, and clear the schedule. Use a new draft when you need to preserve the existing test evidence. Confirm Update only after agreeing on that consequence.')
p('Use End Survey when the agreed response period is finished. Read and confirm the dialog, then verify the ended status and that the mobile participant cannot continue submitting to that survey. Use Delete only for disposable records after reviewing its confirmation.')

page('Checking public pages and additional maps')
h('Public website')
steps(['In a separate signed-out session, open https://healthph.onrender.com/.','Review the home page and its project information, Articles, research team, and contact sections. Use the navigation links to move between sections.','In Articles, open a published article or media resource. Check the full description, image or video, and any supplied external links.','Use Previous articles and Next articles where available. Close media previews and confirm you can return to the list.','If the page offers a comment or report form, use only agreed test text. Confirm its submission message and then check moderation from the administrator session.'])
p('Expected result: public navigation and published resources are usable without administrator access. Do not share invitation, password-reset, verification-code, or signed private media URLs as public test links.')
h('Trends Map where enabled')
p('Some releases retain a separate Trends Map at /dashboard/trends-map. It is not listed in the current main sidebar. Use it only if the coordinator includes it in the test scope.')
steps(['Open the supplied Trends Map link. Apply its region and date-range filters.','Select All Diseases or the relevant disease category. Inspect matching map locations and any accompanying list.','Open a location or list item to review its details.','Use Print Trends Map or Download as PNG if the view offers it; inspect the output.'])
p('The associated Upload Dataset page is an older route. Prefer the shared CSV template and Data Management procedure in this manual for new testing so that the current input rules are followed.')
h('Public full map where enabled')
p('If the public page provides a map link, open it and test its zoom, location details, and return navigation. A retained /full-map route may behave differently when an administrator session is active. Record the entry link, session state, and result rather than assuming every map is the same report.')

page('Updating settings and using Help')
h('Personal information')
steps(['Select the Settings icon in the top navigation.','Select Edit Personal Information. Review First Name, Last Name, Organization, and regional fields that your role allows you to change.','Update the agreed test values and select Save, or select Cancel to discard them.','Confirm the saved values and the account name shown in navigation.'])
p('Expected result: permitted profile details update successfully. Restricted account or access fields should remain controlled by the authorized administrator.')
h('Email and password')
p('For Edit Email, enter the new email and the required current-password confirmation, then submit and follow the resulting instructions. Use only an address controlled by the test account owner; later verification emails may go to it.')
p('For Edit Password, enter the Current Password, New Password, and Confirm Password. Follow the displayed password requirements, save, and verify access using the new password. The account owner should perform this test directly and retain the new credential securely.')
p('Do not include passwords, verification codes, activation links, or reset tokens in screenshots or issue reports.')
h('Help')
steps(['Select the Help icon in the top navigation.','Use its table of contents to find a topic or enter a term in its search field.','Read the matching guidance and return to the relevant module.'])
p('The built-in Help may describe older navigation or features. When its labels differ from the live screen, use the live controls and report the difference to the coordinator. This manual identifies current development and sample-data limits separately.')
h('Finish a session')
p('Save the test evidence, record any test records to retain or remove, and sign out. Share the agreed evidence and issue reports with the coordinator through the collaboration team\'s chosen channel.')

page('Resolving common problems')
table(['What you see','What to try and what to record'],[
('Sign-in or verification fails','Check the email, use the latest code, and use Resend after the timer. Record the exact message without the code.'),('Invitation invalid or not sent','Ask an authorized administrator to verify the account email and resend the invitation. Do not create repeated duplicate accounts.'),('Access Denied or missing module','Confirm the assigned role and accessible pages or regions. Refresh the session after an authorized access change.'),('Empty list or no map pins','Clear search and filters, widen the date range, and check processing status. Empty results do not prove there is no disease activity.'),('Uploaded file rejected','Use the downloaded template. Check the six headers, required IDs and text, and both dates. Correct the row and column named by the message.'),('Queued or Processing remains','Allow time for processing, refresh the view, and check Training Logs. Report the record ID and elapsed time if it does not finish.'),('Failed processing','Read the error. Check file values and service availability with the coordinator before retrying. Preserve the original file.'),('No new alert after checking','Verify saved settings, threshold, time window, eligible reports, and repeat-alert wait. An accepted check need not produce an alert.'),('Prepared alert but no notification','Prepared recipients are not proof of device delivery or reading. Ask the named mobile tester to check the intended inbox and record the time.'),('Content missing publicly','Reopen the item, verify the relevant publication checkbox, and check in a signed-out session or with the intended mobile test recipient.'),('Sentiment has missing results','Inspect the survey card status. Process eligible missing answers if available. Missing results must not be recorded as zero sentiment.'),('Export or print is incomplete','Wait for data, check filters, retry the export, and inspect the output file. Record the tab and requested scope.')],[1.85,4.85])
p('Escalate with the page name, time in Asia/Manila, account role, test record ID, filters, reproduction steps, expected result, actual result, and a screenshot without credentials or unrelated personal information.')

page('Guided collaboration test checklist')
p('Run these scenarios with the agreed test data. Mark Pass, Fail, Blocked, or Not applicable and retain evidence. These are suggested tests, not previously executed test results.')
table(['ID','Action and expected result','Result'],[
('T01','Sign in with email, password, and code. Dashboard opens with the correct role.',''),('T02','Open each permitted module. Restricted functions remain unavailable to an ordinary Admin.',''),('T03','Filter AI Surveillance and inspect a pin. Scope and details match the selected period and region.',''),('T04','Review NLP tabs and print. Available summaries load; development notices remain clear.',''),('T05','Upload a small template CSV and process it. Status reaches Processed and the intended output is visible.',''),('T06','Upload a CSV with an invalid date. The file is rejected with useful corrective guidance.',''),('T07','Process an agreed Submitted self-report. Final status and extracted output are recorded.',''),('T08','Create a test user. Invitation arrives, recipient activates, and permitted pages are accessible.',''),('T09','Disable and re-enable a disposable account. Its ability to sign in follows the saved status.',''),('T10','Create or update a test organization. Its saved values and linked-account restrictions behave as shown.',''),('T11','Save alert choices and run an agreed report check. History explains the result; mobile recipient evidence is checked separately.',''),('T12','Create draft educational content. It appears for Admin but is absent from unselected public channels.',''),('T13','Publish the agreed content. Public or mobile recipient can open the intended media.',''),('T14','Moderate a test website comment. Public visibility follows the saved moderation status.',''),('T15','Create and schedule a survey. The correct mobile test recipient can access it when due.',''),('T16','Submit mobile test answers and process them. Response and answer counts are explained by their definitions.',''),('T17','Apply sentiment and regional filters, then export. Output scope and values match the intended view.',''),('T18','Update agreed profile values, use Help, and sign out. Values persist and the session closes.','')],[.48,5.28,.94])

page('Recording test evidence and issues')
h('Test session record')
table(['Field','Entry'],[('Tester and organization',''),('Test date and Philippine time',''),('Website URL and release identifier if supplied',''),('Browser and version',''),('Account role and permitted regions',''),('Test records and mobile recipient IDs',''),('Overall outcome and outstanding items','')],[2.5,4.2])
h('Issue record')
table(['Field','Entry'],[('Issue ID and short title',''),('Related checklist ID and module',''),('Preconditions and selected filters',''),('Steps to reproduce',''),('Expected result',''),('Actual result and exact message',''),('Record ID and screenshot or output filename',''),('Impact and whether testing can continue',''),('Owner and retest outcome','')],[2.5,4.2])
p('Use one issue record for each distinct problem. Describe the action and observed result precisely, for example: selecting Export as CSV in Regional Analysis produces no downloaded file after results have loaded.')
p('A display with sample values, a documented development notice, or an unavailable data source should be recorded with its stated limitation. The coordinator decides whether that limitation is acceptable for the collaboration test.')

page('Glossary')
table(['Term','Meaning in this manual'],[
('Admin','An administrator role allowed to manage the website functions assigned to it.'),('Superadmin','A broader account type with additional administration powers.'),('Dashboard','The signed-in workspace containing the website modules.'),('CSV','A plain-text table file with comma-separated columns, often prepared in a spreadsheet.'),('Dataset','A collection of source records uploaded together.'),('Self-report','Symptoms and information submitted by a mobile participant.'),('Processing','Automated analysis that adds results such as language, symptoms, and disease labels.'),('NLP','Natural language processing, or automated analysis of text.'),('Entity','An item extracted or categorized from text, such as a disease or symptom.'),('Detection','A model-generated label or matched signal; it does not confirm a diagnosis.'),('Threshold','The report limit above which an alert may qualify.'),('Report window','The past period from which a check counts reports.'),('Prepared recipient','An intended mobile recipient for whom an alert has been prepared; delivery and reading are separate.'),('Draft','A saved item that has not yet been published through its public channel.'),('Published','An item made available through its selected publication workflow.'),('Submission','One completed survey response, which can contain multiple answers.'),('Sentiment','The Calm or Worried label assigned to an eligible survey answer.'),('Satisfaction','A measure calculated using configured scoring rules for eligible answers.'),('Unknown region','A record whose region is missing, conflicting, or cannot be mapped.'),('Philippine time','Asia/Manila, UTC+08:00. Used for the reporting dates identified in the manual.')],[1.5,5.2])

page('Document references and revision record')
h('Documentation approach')
p('This manual uses audience-focused topics, task instructions, expected results, reference information, and troubleshooting. The public description of ISO/IEC/IEEE 26514:2022 identifies the structure, content, format, and development of software information for users as its subject. It is a relevant reference for maintaining this manual; this document does not claim formal conformity certification.')
p('Reference: ISO, ISO/IEC/IEEE 26514:2022, Systems and software engineering - Design and development of information for users. https://www.iso.org/standard/77451.html. Consulted 11 November 2026.')
h('Website reference')
p('Website: https://healthph.onrender.com/\nAdministrator sign-in: https://healthph.onrender.com/login\nScreen reference date: 11 November 2026.')
p('Screenshots show illustrative live records at that date. Use record IDs, selected filters, and actual outcomes in the collaboration test record; do not use the screenshot totals as acceptance targets.')
h('Before using a later release')
bullets(['Confirm that the module names, buttons, permissions, and input rules still match the website.','Recheck alert threshold, report-window, evaluation-interval, and repeat-alert behaviour against the displayed explanation.','Confirm the current content editor and whether an article gallery or single attachment area is offered.','Repeat recipient checks for published content, surveys, and prepared alerts.','Update screenshots, page references, known limitations, and the revision record when behaviour changes.'])
h('Revision record')
table(['Version','Date','Change'],[('1.0','11 November 2026','Initial administrator manual and collaboration testing checklist.')],[.7,1.55,4.45])
h('Support and feedback')
p('Send issues to the project coordinator using the collaboration team\'s agreed support channel. Include the completed issue record and relevant evidence. The coordinator should assign an owner, record the resolution, and arrange a retest before closing an issue.')

# Create compact linked contents with verified intended page numbers.
for item in reversed(pages[2:]):
    para=OxmlElement('w:p')
    pr=OxmlElement('w:pPr');spacing=OxmlElement('w:spacing');spacing.set(qn('w:after'),'65');pr.append(spacing);para.append(pr)
    link=OxmlElement('w:hyperlink');link.set(qn('w:anchor'),f"page_{item['page']}")
    run=OxmlElement('w:r');rpr=OxmlElement('w:rPr');sz=OxmlElement('w:sz');sz.set(qn('w:val'),'21');rpr.append(sz);run.append(rpr)
    tx=OxmlElement('w:t');tx.text=f"{item['page']:02d}    {item['title']}";run.append(tx);link.append(run);para.append(link)
    toc_anchor._p.addnext(para)

for para in DOC.paragraphs:
    if para.style.name in ['Title','Subtitle','Heading 1','Heading 2','Heading 3']:
        for run in para.runs:run.font.color.rgb=RGBColor(0,0,0)
path=OUT/'HealthPH_Plus_Administrator_User_Manual.docx'
DOC.save(path)
(WORK/'chapters.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
print(json.dumps({'docx':str(path),'planned_pages':len(pages),'figures':fig}))
