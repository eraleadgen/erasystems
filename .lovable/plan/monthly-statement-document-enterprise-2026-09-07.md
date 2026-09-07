# Monthly statement document (Enterprise)

A one-page monthly performance statement a client can download from their portal.
Every figure comes from the same calculation code the Analytics tab already uses —
there is no second set of maths anywhere.

## Where the numbers come from

The existing analytics calculation is refactored once: the body that today lives
inside the Analytics server function moves into a shared, business-scoped
function that takes a start date and an end date. The Analytics tab calls it with
its selected range; the statement calls it with the first and last moment of a
calendar month, in the business's own timezone. Same code, same rounding, same
rules about which bookings count. If a rule ever changes, both change together.

## What the document contains

One page, the client's own branding (logo, name, colours), covering a single
named month:

1. Header — business name, "Monthly statement", the month, the date generated.
2. Headline figures — revenue from completed work, completed jobs, average
   ticket, booked-but-not-yet-completed value, and the change against the
   previous month.
3. Revenue by day — a simple bar list for the month, no chart library needed
   in the document.
4. Customers — average and median lifetime value, number of new customers,
   repeat rate, and the top customers of the month.
5. Services — per service: jobs, revenue, average ticket, hours booked,
   earnings per hour, with the same "earnings, not profit" note as the tab.
6. Footer — a plain note that figures cover completed work only, and that
   cancelled and no-show jobs are excluded.

## Format

Server-rendered HTML with print styling, opened in a new tab so the client can
read it or save it as a PDF with the browser's own print dialog. No PDF library
is added: the server runtime can't run the usual PDF/native tooling reliably, and
a print-ready page gives an identical result with none of that risk. If a true
attached PDF is later needed for email, that decision can be revisited on its own.

## Where it appears

A "Statements" card on the Analytics tab (Enterprise-gated, same as the tab):
a list of every completed calendar month since the business went live, each with
a download link. Nothing is pre-generated or stored — the statement is produced
on request from live data, so it can never be stale, and a corrected booking is
reflected the next time it's opened.

## Generation trigger

Pull-only for now, and I'd recommend keeping it that way for this pass:

- The statement is generated on click, always from current data.
- Automatic email would need a monthly scheduled job, a recipient rule (owner
  only? every admin?), and a decision about what happens when a booking is
  corrected after the email went out — the client then holds a statement that
  no longer matches the portal.
- The email mechanism already in the project is ready to reuse, so adding a
  "email me this month's statement" button, or a scheduled send on the 1st, is
  a small follow-up once the document itself is proven in real use.

## Scope

- Refactor of the analytics calculation into a shared date-range function.
- New statement server function and a printable route, both Enterprise-gated and
  business-scoped through the caller's own access — no elevated access.
- A statements list on the Analytics tab.
- No database changes, no pricing changes, nothing outside these surfaces.

## Acceptance check

A test Enterprise client with real bookings across two months: each month's
statement must match, figure for figure, what the Analytics tab shows for the
same range, and a second business must be unable to open the first one's
statement.
