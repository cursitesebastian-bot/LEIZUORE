# Host your event: UX plan

## Principles
- Phone first, one thumb, one task per screen. Pages stay light; forms survive bad connections.
- Never lose entered data: drafts autosave to the server (debounced) and to `localStorage` as a fallback.
- Plain-language validation, shown inline next to the field, never only in a toast.
- Only show numbers we compute. Sample data is always labelled "Sample data".

## Product decisions (confirmed with the owner)
| Topic | Decision |
|---|---|
| Payments | Khalti and eSewa |
| Platform fee | 8% default on paid tickets, overridable per organizer, 0% on free events |
| Paid tickets | Only verified organizers (PAN/VAT or ID approved by an admin) |
| Event review | Every event is reviewed before going live |
| Refunds | Full refund if the attendee cancels 24h or more before the start; organizer-cancelled events are always fully refunded |
| Live edits | Changing date, venue or price on a live event sends it back to review and notifies attendees |
| Jobs / storage / SMS | ARQ on Redis / S3-compatible (S3, R2, MinIO) / SMS adapter with console logger in dev |

## Screen list
Public
1. Landing section "Host your event" + "How it works" strip (`/`)
2. Host landing and sign-in (`/host`)

Organizer
3. Onboarding: sign in (phone OTP or email) → profile → optional verification (`/host/onboarding`)
4. Create/edit event, 5 steps: Basics, When, Where, Tickets, Review (`/host/events/new`, `/host/events/[id]/edit`)
5. Dashboard overview (`/host/dashboard`)
6. Events list with status chips and actions (`/host/events`)
7. Event detail: bookings table, CSV export, announcement (`/host/events/[id]`)
8. Check-in scanner (`/host/events/[id]/check-in`)
9. Payouts (`/host/payouts`)

Attendee touchpoints
10. Event page "Hosted by ..." (`/events/[slug]`)
11. Booking confirmation with QR ticket (`/bookings/[id]`)
12. Reminder messages (SMS/email, 24h and 2h before)

Admin
13. Review queue: approve or reject with a reason (`/admin/events`)

## User flow
```
Landing -> Start hosting -> Sign in (OTP) -> Organizer profile -> [Verification, optional]
   -> Create event (Basics > When > Where > Tickets > Review)
        |-- Save draft (resume anytime)
        '-- Submit for review -> In review -> Admin approves -> Live -> Ended
                                          '-> Rejected (reason shown, edit, resubmit)
Live -> Attendees book (free or paid) -> QR ticket -> Reminders -> Check-in at the door
     -> Revenue to balance -> Payout request
```

## Screen states
| Screen | Empty | Loading | Error | Success |
|---|---|---|---|---|
| Sign in | Phone/email field with example | Button shows "Sending code..." | "That code is wrong. 2 tries left." / "Too many tries, request a new code in 10 min." | Redirect to profile or dashboard |
| Profile | Prefilled from account | Skeleton form | Field-level messages; upload failure keeps the form | "Profile saved" and next step |
| Verification | Explains why (paid tickets), skippable | Upload progress | "We could not read that file. Try a clearer photo." | Status chip: Pending, then Verified/Rejected with reason |
| Create event | Blank step 1 | Autosave indicator "Saving..." | "Saved on this phone only, we'll retry" banner | "Draft saved" / "Submitted for review" |
| Dashboard | "No events yet" with Create event button | Card skeletons | Retry card | Real totals only |
| Events list | Same as above | Row skeletons | Retry | Status chips: Draft, In review, Live, Ended, Cancelled, Rejected (+ reason) |
| Bookings | "No bookings yet. Share your event link." | Table skeleton | Retry | CSV download |
| Check-in | Camera permission prompt + manual search | "Checking..." | Red: "Already used at 18:42" / "Not valid for this event" | Green: name, ticket type, quantity |
| Payouts | "No earnings yet" | Skeleton | Retry | "Payout requested" |

## Create-event step details
1. Basics: title, category, description, cover (cropped to the card ratio 16:10), up to 5 gallery images.
2. When: start/end in Asia/Kathmandu, weekly repeat, registration deadline.
3. Where: venue, address, map pin fills lat/lng, "Online event" toggle hides the venue fields.
4. Tickets: free or paid, ticket types (General, VIP), NPR price, capacity, max per person, sales window. Paid shows a banner when the organizer is not verified.
5. Review: live preview of the card and event page, then "Submit for review" or "Save draft".

## Locale rules
- Prices in NPR (`Rs 1,200`), timezone Asia/Kathmandu, dates stored in UTC.
- Saturday is the weekly holiday: weekly-repeat defaults to Saturday morning and the "this week" filter starts on Sunday.
- Light bundles: no map SDK on the landing page, images lazy-loaded.
