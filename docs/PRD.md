# LevyPass — Product Requirements Document

Nov 5, 2026 · @seun

## 1. Overview

LevyPass is a payment and verification platform for market, motor park and street levies. Traders pay digitally, the money settles straight into the government's Access Bank account, and enforcement officers confirm payment by scanning a QR code. It is Team FET's entry for Access Youth Tech Forge 2026, Track 01: Payments and Financial Infrastructure.

### The problem

In Lagos and most Nigerian cities, traders, keke and okada riders, and shop owners pay daily or weekly levies in cash. The person collecting is often not a verified government officer. That creates five failures:

- **No proof of payment.** Traders get no receipt, or a paper ticket anyone can print.
- **Double charging.** Different collectors demand the same levy on the same day.
- **Harassment.** Without proof, a trader cannot push back against an unlawful demand.
- **Revenue leakage.** Money is collected in the government's name but does not reach its account.
- **No data.** Government cannot see who paid, where, or how much, so it cannot plan or audit.

### Vision

Every levy in an African city is paid digitally, settled straight to the right public account, and provable on the spot with one scan. LevyPass does for levies what the Cowry card did for Lagos transport: one shared payment flow for the payer, the government and the bank.

### Goals

1. Give every registered trader a single QR ID that proves their payment status in real time.
2. Let traders pay by bank transfer, USSD or card, including on basic feature phones.
3. Settle every naira directly into the government's collection account, with no cash in hand.
4. Give enforcement officers a fast, reliable way to verify payment and their own authority.
5. Give revenue administrators live collection data and fraud alerts.
6. Build a payment history that Access Bank can later use to offer traders credit and savings.

### Non-goals

- LevyPass does not set levy amounts or decide which levies are lawful. Government does.
- It does not replace income tax, company tax or other state tax systems.
- It does not hold customer funds itself. Funds move through licensed banks and payment providers.
- Lending and savings products are a later phase, not part of the first release.

## 2. Users and personas

LevyPass serves four groups. The trader and the officer meet face to face every day, so both of their tools must work in seconds, in a crowded market, on cheap phones.

| User | Who they are | What they need | Device and constraints |
| --- | --- | --- | --- |
| Trader (payer) | Market trader, shop owner, keke or okada rider, street vendor | Pay quickly, prove payment, stop double charges and harassment | Often a feature phone; may be unbanked; may prefer Yoruba, Pidgin, Hausa or Igbo; data is costly |
| Enforcement officer | Government levy officer or task-force member on the street | Check a trader's status in seconds; prove their own identity | Android smartphone; poor network in some markets; works outdoors in sun and noise |
| Revenue administrator | Staff of a local government council or state revenue agency | Set levies, see collections, spot fraud, manage officers, reconcile with the bank | Laptop or desktop in an office |
| Bank partner | Access Bank collections and product teams | Collection accounts, settlement reports, a route to new customers | Bank systems and APIs |

### Persona: Mama Bisi, fabric trader

Mama Bisi sells fabric in a large Lagos market. She pays a daily levy in cash and sometimes pays twice when a second collector comes. She has a basic phone and a bank account she rarely uses. She wants to pay once, quickly, and have something she can show to anyone who asks.

### Persona: Officer Musa, levy enforcement officer

Officer Musa covers 300 stalls a day. Traders often refuse to pay him because touts have collected before him. He wants to know who has paid without arguing, and he wants traders to trust that he is genuine.

### Persona: Mrs Adeyemi, revenue administrator

Mrs Adeyemi manages levy collection for a local government. She does not know how much is really collected each day. She wants one dashboard showing collections by market, an alert when something looks wrong, and figures that match the bank statement.

## 3. User journeys

Six journeys make up the product. Journeys A to C are the core loop the hackathon demo must show end to end.

### A. Trader registers

1. The trader dials the LevyPass USSD code, opens the web app, or is registered on the spot by an officer or a market association agent.
2. They enter their name, phone number, market, stall or vehicle number, and business type.
3. LevyPass checks the phone number by one-time code (OTP).
4. The trader picks or is assigned the levies that apply to them, for example a daily market levy.
5. LevyPass creates a trader ID and a QR code. The trader gets the QR as a printed sticker for the stall or vehicle and as an image sent by WhatsApp or as an SMS link.
6. LevyPass gives the trader a dedicated virtual account number for paying levies.

### B. Trader pays a levy

1. The trader chooses how to pay: transfer to their virtual account, USSD, card, or the web app.
2. LevyPass shows what is due and lets them pay for one day, a week or a month ahead.
3. The payment provider confirms the payment to LevyPass by webhook.
4. LevyPass matches the payment to the trader and the levy, and marks the period as paid.
5. The money settles into the government's Access Bank collection account.
6. The trader gets a receipt by SMS or WhatsApp with a receipt number and a verification link.

### C. Officer verifies a trader

1. The officer logs in to the officer app with their staff ID and PIN.
2. They scan the trader's QR code, or type the trader ID if the sticker is damaged.
3. The app shows the trader's name, photo if available, stall, and a clear **Paid** or **Not paid** for today.
4. If not paid, the officer can show a payment link or USSD code so the trader pays on the spot.
5. Every scan is logged with the officer, time and place.

### D. Trader verifies an officer

1. The trader scans the QR on the officer's ID card, or texts the officer's ID number to a short code.
2. LevyPass replies with the officer's name, photo, assigned area, and whether their ID is active.
3. A trader can report a fake or abusive collector from the same screen.

### E. Administrator manages levies

1. The administrator sets up markets, levy types, amounts and payment periods.
2. They register officers and assign them to markets.
3. They watch the dashboard: collections today, by market, by levy, by officer area.
4. They review fraud alerts and complaints, and act on them.
5. They export reports and reconcile them against the bank's settlement statement.

### F. Dispute or refund

1. A trader who was charged twice or paid the wrong levy raises a dispute in the app, by USSD or through a help line.
2. The administrator sees the dispute beside the payment record.
3. If approved, the payment is credited to the next period or refunded through the payment provider.
4. The trader is told the outcome by SMS.

## 4. Functional requirements

Priorities: **P0** = needed for the hackathon demo; **P1** = needed for a real market pilot; **P2** = later.

### 4.1 Trader registration and identity

| ID | Requirement | Priority |
| --- | --- | --- |
| TR-01 | Register a trader with name, phone, market, stall or vehicle number and business type | P0 |
| TR-02 | Verify the phone number by OTP | P0 |
| TR-03 | Generate a unique trader ID and a signed QR code | P0 |
| TR-04 | Register by USSD, by web app, or assisted by an officer or agent | P1 |
| TR-05 | Capture a photo of the trader or stall during assisted sign-up | P1 |
| TR-06 | Optional BVN or NIN check for traders who want bank products later | P2 |
| TR-07 | Print-ready QR sticker with trader ID and market name | P1 |
| TR-08 | Re-issue a lost or damaged QR and cancel the old one | P1 |

### 4.2 Levies and billing

| ID | Requirement | Priority |
| --- | --- | --- |
| LV-01 | Admin defines levy types with amount, period (daily, weekly, monthly, yearly) and the markets they apply to | P0 |
| LV-02 | Each trader sees what is due today and any arrears | P0 |
| LV-03 | Pay ahead for several periods in one payment | P1 |
| LV-04 | Different amounts by stall size, business type or vehicle type | P1 |
| LV-05 | Exemptions and waivers set by the admin, with a reason recorded | P2 |
| LV-06 | Each levy records the law, bye-law or approval it is based on | P1 |

### 4.3 Payments

| ID | Requirement | Priority |
| --- | --- | --- |
| PY-01 | Dedicated virtual account per trader; any transfer to it is matched automatically | P0 |
| PY-02 | Pay by card and bank transfer through a payment gateway checkout | P0 |
| PY-03 | Pay by USSD on a feature phone | P0 (simulator) |
| PY-04 | Payment confirmed by webhook and checked again with the provider before marking paid | P0 |
| PY-05 | Every payment settles to the government's collection account, never to an individual | P0 |
| PY-06 | Handle part payments, overpayments and payments for the wrong amount | P1 |
| PY-07 | Refunds through the payment provider, approved by an admin | P1 |
| PY-08 | Split settlement where a market association is entitled to a lawful share | P2 |

### 4.4 Receipts

| ID | Requirement | Priority |
| --- | --- | --- |
| RC-01 | Instant receipt by SMS with receipt number, amount, levy, period and verification link | P0 |
| RC-02 | Receipt by WhatsApp where the trader opts in | P1 |
| RC-03 | Public receipt check page: enter a receipt number and see if it is genuine | P0 |
| RC-04 | Receipt history in the trader web app and by USSD | P1 |

### 4.5 Officer app and verification

| ID | Requirement | Priority |
| --- | --- | --- |
| OF-01 | Officer login with staff ID and PIN; device bound to the officer | P0 |
| OF-02 | Scan a trader QR and show Paid or Not paid for the current period in under 3 seconds | P0 |
| OF-03 | Look up a trader by ID when the QR cannot be scanned | P0 |
| OF-04 | Show a pay-now link or USSD code to a trader who has not paid | P1 |
| OF-05 | Offline mode: cache the day's paid list for the officer's market and sync later | P1 |
| OF-06 | Log every scan with officer, time and GPS location | P0 |
| OF-07 | Officer digital ID with its own QR that traders can scan to verify them | P0 |
| OF-08 | Admin can suspend an officer ID at once | P0 |

### 4.6 Admin dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| AD-01 | Live totals: today, this week, this month, by market and by levy | P0 |
| AD-02 | Compliance rate per market: share of registered traders who have paid this period | P0 |
| AD-03 | Manage markets, levies, officers and their areas | P0 |
| AD-04 | Fraud and complaint queue with actions | P0 |
| AD-05 | Export to CSV and PDF; daily reconciliation report against bank settlement | P1 |
| AD-06 | Role-based access: super admin, market admin, finance, auditor (read only) | P1 |
| AD-07 | Full audit log of every admin action | P1 |

### 4.7 Fraud and complaints

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Flag a trader charged twice for the same levy and period | P0 |
| FR-02 | Flag a receipt number that does not exist or was used before | P0 |
| FR-03 | Flag scans by a suspended or unknown officer ID | P0 |
| FR-04 | Trader reports a fake collector, with location and optional photo | P1 |
| FR-05 | Flag unusual patterns: an officer scanning far outside their area, or a market whose collections drop sharply | P1 |

### 4.8 Notifications

| ID | Requirement | Priority |
| --- | --- | --- |
| NT-01 | SMS for OTP, receipts and dispute outcomes | P0 |
| NT-02 | Optional reminders before a levy is due | P1 |
| NT-03 | Messages in English, Yoruba, Pidgin, Hausa and Igbo | P1 |

### 4.9 Trader finance (later)

| ID | Requirement | Priority |
| --- | --- | --- |
| FN-01 | With the trader's consent, share their payment history with Access Bank | P2 |
| FN-02 | Offer savings and small loans based on payment history | P2 |

## 5. Non-functional requirements

The hardest constraints come from the street: cheap phones, weak networks, busy officers and traders who may not read English well.

| Area | Requirement |
| --- | --- |
| Speed | QR scan to Paid / Not paid in under 3 seconds on a 3G connection; receipt SMS within 60 seconds of payment confirmation |
| Availability | 99.5% uptime for payment webhooks and the verification API during the pilot; 99.9% at scale |
| Offline | Officer app keeps working with no network for a full shift, using a cached paid list, and syncs scans when back online |
| Low data | Officer app under 10 MB; verification response under 5 KB; trader web app usable on 2G |
| Feature phones | Every trader task (register, pay, check status, get receipt, report a collector) works by USSD and SMS alone |
| Languages | English, Yoruba, Pidgin, Hausa and Igbo across USSD, SMS and apps |
| Accessibility | Large text and high contrast for outdoor use; icons beside every status word; screen-reader labels on the web app; voice-call help line for traders who cannot read |
| Scale | Pilot: one market. Design target: millions of traders and tens of millions of payments a year without a redesign |
| Data integrity | Every payment state change is recorded in an append-only ledger; balances are always recomputable from it |
| Reconciliation | LevyPass totals match the bank settlement statement every day, with any gap explained |
| Auditability | Every admin action, scan and payment is time-stamped and traceable to a person or system |
| Maintainability | Levy rules, amounts and markets are configuration, not code |

## 6. Security, fraud and data protection

The core security rule is simple: **no person ever holds government money.** Money reaches the government's collection account only through licensed providers. A trader with no bank may pay an officer cash, but only after that officer has made an **advance remittance** of at least that amount into the collection account, approved by the revenue office and confirmed by the bank. The cash is the officer's own money coming back; each cash levy is paid from the officer's advance, receipted by SMS naming the officer, and every remittance is accounted for collection by collection.

### 6.1 Threats and controls

| Threat | How LevyPass stops it |
| --- | --- |
| Fake collector demands cash | Traders learn that cash counts only with an SMS receipt naming the officer, sent there and then; any trader can verify an officer by scanning the officer's ID QR or texting a short code |
| Officer pockets cash and records nothing | The trader gets no SMS and the next scan still shows NOT PAID; cash can only be recorded against a fresh scan of that trader, inside the officer's market |
| Officer records more cash than the government received | Impossible by construction: cash is paid out of an advance remittance the bank has confirmed, and the advance cannot go below zero |
| Fake receipt or screenshot | Receipts are checked against the live ledger, never trusted from the image; each receipt number is single-use |
| Forged or copied trader QR | QR carries a signed token (HMAC or Ed25519), not just an ID; the officer app checks the signature and shows the trader's photo |
| Spoofed payment webhook | Webhooks verified by provider signature; payment then confirmed by a server-to-server status call before marking paid |
| Insider fraud by staff | Role-based access; four-eyes approval for refunds, waivers and levy changes; full audit log; auditors have read-only access |
| Officer device stolen | PIN on the app; device binding; admin can suspend the officer and the device at once |
| Double charging | One payment record per trader, levy and period; a second payment for the same period is flagged and credited forward |
| Account takeover | OTP on phone change; rate limits on login and OTP; alerts on unusual activity |

### 6.2 Technical security

- TLS for all traffic; encryption at rest for the database and backups.
- Secrets in a managed vault, never in code.
- Least-privilege service accounts for each component.
- Rate limiting and bot protection on public endpoints.
- Regular dependency scanning, and a penetration test before the pilot goes live.
- Daily encrypted backups with a tested restore.

### 6.3 Data protection (Nigeria Data Protection Act 2023)

- **Lawful basis.** Collection of levy data rests on the government's public function; marketing or credit uses rely on the trader's separate, opt-in consent.
- **Data minimisation.** Collect only what levy collection needs: name, phone, market, stall, levy history. BVN or NIN only for traders who choose bank products.
- **Transparency.** A plain-language privacy notice in each supported language, also readable by USSD.
- **Trader rights.** Traders can see, correct and request deletion of data that law does not require the government to keep.
- **Sharing.** No sharing with Access Bank or third parties for lending without the trader's explicit consent.
- **Location data.** Officer scan locations are kept for audit; traders' locations are recorded only as their registered market and stall.
- **Retention.** Payment records kept for the period public finance and tax law require; other data deleted when no longer needed.
- **Governance.** A named data protection officer, a data protection impact assessment before the pilot, and breach notification to the Nigeria Data Protection Commission within the legal deadline.

## 7. Architecture, tech stack, data model and APIs

LevyPass is one backend with three front doors (trader, officer, admin) and a ledger at the centre. Payment providers talk to it by webhook; it never holds funds.

&#91;embedded content: LevyPass architecture · 3 front doors, 4 services, 1 ledger, 3 providers\]

Traders, officers and admins reach one backend. Every service writes to one append-only ledger, and money moves only between banks.

### 7.1 Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Trader and admin web apps | Next.js (React, TypeScript) | One codebase for web apps and API routes; fast to build |
| Officer app | Progressive web app with camera QR scanning; Android app later | Installs from a link, works offline, no app store wait |
| Backend API | Node.js (TypeScript) on Next.js API routes or NestJS | Same language end to end |
| Database | PostgreSQL (Supabase for the hackathon) | Strong consistency for money; row-level security |
| Ledger | Append-only `ledger_entries` table in Postgres | Every naira traceable; balances recomputable |
| Queue and jobs | Background jobs for webhooks, SMS and reconciliation (e.g. BullMQ with Redis) | Retries without losing events |
| Payments | Paystack or Flutterwave (test mode for the hackathon); Access Bank collections APIs for production | Virtual accounts, card, transfer, USSD |
| USSD and SMS | Africa's Talking (sandbox for the hackathon) | USSD menus, SMS and voice in Nigeria |
| WhatsApp | WhatsApp Business Platform | Receipts and status for smartphone users |
| QR | Signed tokens rendered as QR codes; html5-qrcode or similar for scanning | Tamper-proof, works in the browser |
| Hosting | Vercel for the web apps; managed Postgres; a Nigerian or nearby cloud region for production data | Fast to ship; data residency later |

### 7.2 Data model

| Entity | Key fields |
| --- | --- |
| Authority | id, name, tier (state or local government), collection account |
| Market | id, authority\_id, name, location, type (market, motor park, street) |
| Trader | id, phone, name, market\_id, stall\_or\_vehicle, business\_type, photo\_url, qr\_token, status |
| LevyType | id, authority\_id, name, amount, period, legal\_basis, applies\_to |
| TraderLevy | trader\_id, levy\_type\_id, start\_date, exemption |
| Obligation | id, trader\_id, levy\_type\_id, period\_start, period\_end, amount\_due, status (due, paid, waived) |
| Payment | id, trader\_id, provider, provider\_ref, amount, channel, status, paid\_at |
| LedgerEntry | id, payment\_id, obligation\_id, debit\_account, credit\_account, amount, created\_at (never updated) |
| Receipt | number, payment\_id, issued\_at, verification\_url |
| Officer | id, authority\_id, staff\_id, name, photo\_url, assigned\_markets, device\_id, status |
| Scan | id, officer\_id, trader\_id, result, latitude, longitude, scanned\_at, online\_or\_synced |
| FraudFlag | id, type, trader\_id, officer\_id, payment\_id, status, notes |
| Complaint | id, reporter\_trader\_id, officer\_id or unknown collector, description, photo\_url, status |
| AuditLog | id, actor\_id, action, target, before, after, at |

### 7.3 Main API endpoints

| Method and path | Purpose |
| --- | --- |
| POST /traders | Register a trader |
| POST /auth/otp, POST /auth/verify | Phone verification |
| GET /traders/{id}/obligations | What is due and paid |
| POST /payments/checkout | Start a card or transfer payment |
| POST /webhooks/{provider} | Receive payment confirmations |
| GET /verify/trader?token= | Officer scan: Paid or Not paid |
| GET /verify/officer?token= | Trader checks an officer |
| GET /receipts/{number} | Public receipt check |
| POST /ussd | USSD session handler |
| POST /scans/sync | Upload scans made offline |
| POST /complaints | Report a fake or abusive collector |
| GET /admin/collections | Dashboard totals and filters |
| GET /admin/reconciliation?date= | Daily match against bank settlement |

### 7.4 How a payment is matched

1. Each trader has a virtual account number, so the account itself identifies the payer.
2. The provider's webhook arrives; LevyPass checks its signature and confirms the payment with the provider.
3. LevyPass applies the amount to the oldest unpaid obligation first, then to future periods if the trader paid ahead.
4. It writes ledger entries, marks the obligations paid, issues the receipt and sends the SMS.
5. Any amount it cannot match goes to a review queue, never silently lost.

## 8. Integrations

LevyPass depends on five outside services, plus identity checks later. Each one runs in sandbox for the hackathon and switches to live credentials for the pilot without code changes.

| Integration | What LevyPass uses it for | Hackathon | Pilot and beyond |
| --- | --- | --- | --- |
| Access Bank | Government collection account; virtual accounts per trader; settlement and statement data for reconciliation | Simulated, or Access Bank sandbox if provided at onboarding | Access Bank collections and virtual account APIs; daily settlement files |
| Payment gateway | Card and transfer checkout; dedicated virtual accounts; webhooks; refunds | Paystack or Flutterwave test mode | Kept as a second rail beside Access Bank, or replaced by it |
| USSD | Feature-phone menus to register, pay, check status, verify an officer and report a collector | Africa's Talking USSD simulator | Live short code through an aggregator; bank USSD for payment |
| SMS | OTP, receipts, reminders, dispute outcomes | Africa's Talking sandbox | Live sender ID, registered with telecom operators |
| WhatsApp | Receipts, status checks, QR image delivery | Optional; test number | WhatsApp Business Platform with approved message templates |
| Identity (later) | BVN or NIN check for traders who opt into bank products | Not used | Through Access Bank's existing checks |

### USSD menu (draft)

1. Pay levy
2. Check what I owe
3. My last receipt
4. Check an officer
5. Report a collector
6. Change language

### Integration rules

- Every outside call has a timeout, retries with back-off, and an alert when it keeps failing.
- Webhooks are idempotent: the same event processed twice changes nothing.
- Provider references are stored on every payment so any transaction can be traced at the bank.

## 9. Legal and regulatory considerations

LevyPass only works if every levy it collects is lawful and every collector it verifies is authorised. That legal grounding is the team's edge, and it shapes the product.

| Area | What applies | What LevyPass does about it |
| --- | --- | --- |
| Who may collect levies | The Fourth Schedule to the 1999 Constitution gives local government councils functions including the collection of rates and the regulation of markets and motor parks; state laws and local bye-laws set the details | Each levy type records its legal basis (LV-06); LevyPass works only under a signed agreement with the authority that owns the levy |
| Approved taxes and levies | Federal law has long set an approved list of taxes and levies each tier may collect, and barred collection by anyone other than the proper tax authority | Only levies on the approved list for that tier can be set up; officers must be the authority's own staff or its formally appointed agents |
| Payments regulation | Central Bank of Nigeria rules on payment service providers and collections | LevyPass never holds funds; money moves through Access Bank and licensed payment providers, so LevyPass operates as a technology provider |
| Data protection | Nigeria Data Protection Act 2023 and the Nigeria Data Protection Commission | See section 6.3: lawful basis, minimisation, consent for credit use, impact assessment, a data protection officer |
| Electronic receipts as evidence | Evidence Act 2011 (as amended in 2023) on electronic records and computer-produced documents | Receipts and scan logs are stored so they can be produced as reliable electronic evidence in a dispute |
| Fraud and impersonation | Cybercrimes (Prohibition, Prevention, etc.) Act 2015 and the Criminal Code | Reports of fake collectors are logged with evidence and can be passed to the authority and police |
| Government contracting | Federal and state public procurement laws | The pilot is set up as a formal agreement or pilot MOU with the authority, with fees agreed in writing |
| Consumer protection | Federal Competition and Consumer Protection Act 2018; CBN consumer protection rules | Clear fees (none for traders), a dispute process, and a help line |

**To confirm with counsel before the pilot:** how the Nigeria Tax Act 2025 and Nigeria Tax Administration Act 2025, in force from 2026, now carry the approved list of levies, and which Lagos State laws and local bye-laws govern market and motor park levies in the pilot area.

## 10. Business model and success metrics

Government pays a small fee on each levy collected, out of revenue it currently loses to leakage. Traders pay nothing extra. Access Bank gains accounts, deposits and data on a customer group it rarely reaches.

### 10.1 Who benefits and who pays

| Party | What they get | What they pay |
| --- | --- | --- |
| Trader | Proof of payment, no double charges, protection from fake collectors, a path to bank products | Nothing beyond the levy itself |
| Government | More revenue reaching its account, live data, audit trail, less cash handling | A fee per successful collection, agreed per contract (\[fee to be set\]) |
| Access Bank | Collection account balances, new trader accounts, transaction volume, credit data with consent | Integration support; possible revenue share on new products |
| LevyPass | Fee income that grows with every market onboarded | Running costs: SMS, USSD sessions, hosting, support |

### 10.2 Revenue streams

1. **Collection fee** paid by the authority on each successful payment.
2. **Set-up fee** per market or authority for onboarding, stickers and officer training.
3. **Premium analytics** for state revenue agencies covering many local governments.
4. **Later:** a share of savings and credit products offered with Access Bank to traders who opt in.

### 10.3 Success metrics

| Metric | What it shows | Pilot target |
| --- | --- | --- |
| Registered traders as a share of traders in the pilot market | Reach | \[target\] |
| Compliance rate: registered traders who paid this period | Adoption | \[target\] |
| Levy revenue reaching the government account, before vs after | Leakage closed | \[target\] |
| Share of payments made by USSD or feature phone | Inclusion | Tracked, no target |
| Median time from QR scan to result | Officer experience | Under 3 seconds |
| Days where LevyPass totals match bank settlement | Reconciliation | 100% |
| Double-charge and fake-collector reports per 1,000 traders, month on month | Fraud falling | Falling every month |
| Trader satisfaction (short SMS survey) | Trust | \[target\] |

Pilot targets in brackets are set with the partner authority once baseline figures are known.

## 11. Release plan, risks and open questions

LevyPass ships in four phases: the hackathon demo, a one-market pilot, a full local government, then other cities. Each phase starts only when the gate before it is passed.

&#91;embedded content: LevyPass roadmap · 4 phases, 3 gates\]

Only the hackathon has fixed dates; the pilot dates follow from the partner authority's agreement.

### 11.1 Hackathon build (9 to 11 November 2026, demo day 13 November)

1. **Day 1:** trader registration with OTP, signed QR codes, levy set-up, test-mode payments into virtual accounts, webhook matching and the ledger.
2. **Day 2:** SMS receipts and public receipt check, officer scan app with Paid / Not paid, officer ID verification, USSD flow in the simulator.
3. **Day 3:** admin dashboard with live totals and compliance rate, fraud flags (double charge, fake receipt, suspended officer), seed data for one market, demo script and pitch.

**Demo script:** register a trader live → pay by USSD in the simulator → receipt SMS lands → officer scans the QR and sees Paid → scan an unpaid trader and show Not paid → try a fake receipt and show the flag → dashboard total moves.

### 11.2 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Collectors and touts who profit from cash resist the change | Pilot stalls; possible conflict in the market | Work through the authority and market association leaders; give officers a role, not just oversight |
| Government partner slow to sign or changes leadership | No pilot | Start with one supportive local government; formal MOU; show results fast |
| Traders distrust a new system or lack phones | Low uptake | USSD for feature phones, assisted sign-up, market association champions, no extra fee |
| Weak network in markets | Failed scans and payments | Offline officer mode; USSD and SMS fallbacks |
| Levy found unlawful or duplicated across tiers | Legal challenge; reputational harm | Legal basis recorded per levy; counsel review before go-live |
| Payment provider outage | Missed payments | Two payment rails; queue and retry; status page |
| Data breach | Harm to traders; regulatory penalties | Section 6 controls, impact assessment, penetration test |

### 11.3 Open questions

- [ ] Which local government or market will host the pilot?
- [ ] Will Access Bank provide sandbox access to its collections and virtual account APIs at onboarding?
- [ ] What collection fee will the authority accept, and how is it paid?
- [ ] Do market associations receive a lawful share of any levy, requiring split settlement?
- [ ] How do the 2025 tax laws now set out the approved list of levies for each tier?
- [ ] Who in Team FET owns which part of the build for the hackathon?
