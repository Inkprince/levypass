# LevyPass pitch: speaker script

Access Youth Tech Forge 2026, Track 01. Demo day, 13 November.
Presenter: Oluwaseun. Iteoluwakiishi (project manager) is named in the introduction.

## How to use this

- Plain paragraphs are what you say out loud. *Lines in italics* are what you do.
- Don't memorise it word for word. Learn the beats and say them your own way. If you sound like
  you're reading, slow down and look at the judges.
- Speak slower than feels natural. Pause after the numbers.
- You play every role in the demo: the trader, the officer and the revenue office. Say which one
  you are each time you switch, so the judges can follow.

## Timing

We still don't have the judging rubric or the slot length. This plan runs about nine and a half
minutes with the full demo. If the slot is shorter, use the five-minute cut further down.

| Part | Time |
| --- | --- |
| Slide 1, title | 0:20 |
| Slide 2, the problem | 0:50 |
| Slide 3, our solution | 0:35 |
| Live demo | 5:00 |
| Slide 4, why us | 0:40 |
| Slide 5, technology and security | 0:50 |
| Slide 6, business model | 0:45 |
| Slide 7, bank fit and scale | 0:40 |
| Slide 8, close | 0:15 |

---

## Slide 1: LevyPass

Good morning. I'm Oluwaseun from Team FET, and this is LevyPass. I built it with Iteoluwakiishi,
our project manager.

Every day, traders in markets and motor parks across Nigeria pay levies, and most of them pay in
cash. LevyPass lets them pay from any phone. The money goes straight into the government's Access
Bank account, and anyone can prove a payment with one scan.

*Point to the phone on the slide.*

That phone isn't a mock-up. It's our officer app, captured from the running build.

---

## Slide 2: The problem

Let me tell you about Mama Bisi. She isn't a real person, but anyone who trades in a Lagos market
will know her story.

She sells fabric. Every morning someone comes for the market levy, and she pays cash. Some days
she gets a paper ticket. Some days she gets nothing. And some days a second man turns up, says
he's from the council too, and she pays again. She can't tell who's genuine, and she can't prove
she's already paid.

She isn't unusual.

*Point to 98%.*

When SBM Intelligence surveyed informal businesses, 98% said they already pay levies.

*Point to 38%.*

And 38%, more than a third, pay two or three different groups for the same business.

*Pause.*

So the money is there. Traders are paying. The problem is that much of it never reaches the
government's account, and nobody can audit what does.

And this is urgent now. The 2026 tax framework cut more than a hundred state and local taxes down
to nine revenue heads, and it bans paying them in cash. Councils need to stop handling cash, without
shutting out the traders who only have cash. And they need it this year.

---

## Slide 3: Our solution

Here's LevyPass in five steps.

One. Mama Bisi registers with her phone number and gets her LevyPass card: a signed QR on her
stall, or a card in her pocket if she's an okada rider with no stall.

Two. She pays by USSD on any phone, even one with no internet, or by transfer or card. Her SMS
receipt arrives in about three seconds. And if she has no bank at all, she can pay the officer
cash. I'll show you why that money still can't go missing.

Three. When an officer comes round, he scans her LevyPass card. He sees PAID or NOT PAID in under a
second.

Four. She can scan him back. His ID tells her whether he's a real officer, or one who's been
suspended.

Five. The revenue office sees all of it live: the totals, the fraud flags, and a check against
the bank.

Rather than tell you more, let me show you.

*Switch the screen to the browser on `/demo`.*

---

## Live demo (about five minutes)

Steps 1 to 3 and 8 are the core. If time runs short, drop steps 5 and 6 first, then 4. Never drop
step 7; it's what sets us apart.

### Step 1: Mama Bisi registers

First, I'm Mama Bisi. I type in my name, my phone number and my stall.

*Submit. Click "Open the phone simulator".*

This is a simulated phone, because we can't send real SMS from the sandbox. There's my code.

*Type the code in.*

And that's my pass. That QR is my LevyPass card. It goes on the stall, or, for a rider, it's printed
at bank-card size to keep in a wallet.

*Optional, five seconds: tap "Print my LevyPass card" to show the card, then go back.*

> **If it fails:** log in as a seeded trader instead (`+2347000000101`, code from `/sim`) and say
> "she's already registered, so let's go straight to paying".

### Step 2: She pays by USSD

Today she owes two thousand five hundred naira: today's five hundred naira market levy, and this
week's two thousand naira sanitation levy.

*In the simulator, dial `*347*13#` and follow the menu.*

She dials star three four seven star thirteen hash. That works on any phone.

*Confirm. Watch the inbox.*

And there's her receipt.

*Read the seconds out loud. In rehearsal it was between two and four.*

> **Check first:** the ₦2,500 figure is only right after `demo:reset`. If someone has added a levy,
> just read whatever amount the screen shows.

### Step 3: The officer scans

*Pick up the officer phone, already logged in as OTT-001.*

Now I'm Officer Musa. I come to her stall and scan.

*Scan Mama Bisi's QR, on the laptop screen or a printed sticker.*

PAID. That took under a second.

*Scan an unpaid trader's sticker.*

This trader hasn't paid. NOT PAID, and he gets a code he can pay with right there.

> **If the camera won't focus:** type the trader ID in by hand. If the phone itself fails, scan
> the printed stickers on the laptop's webcam.

### Step 3b: No bank? Cash, without the leak

*Still the officer phone. Before the demo, after `demo:reset`: OTT-001 has no advance. Do the
remittance part live; it takes about forty seconds.*

Now the question everybody asks: what about the trader who says "I no get bank"? He has cash, and
that's all he has. We don't turn him away. We just make sure his cash can't disappear.

*Tap the "Advance" card, then "Request an advance remittance" for ₦20,000.*

Before Officer Musa can take a single naira in cash, he makes an advance remittance. Today,
collectors collect first and remit later, and "later" is where the money disappears. We flip it:
remit first, collect after. He asks the revenue office for twenty thousand.

*Switch to `/admin/remittances`. Approve.*

The revenue office approves it.

*Back to the officer phone. "Pay in ₦20,000", then "Sandbox: approve".*

And he pays that twenty thousand into the government's account first. The bank confirms it.
So the government already has the money before any trader hands him cash.

*Go back to the scanner. Scan or type the unpaid trader from step 3. Tap "No bank? Take ₦500
cash", then "I have the cash".*

The trader pays him five hundred naira cash. Musa taps once. The levy is paid out of his advance,
and the trader gets an SMS receipt with Musa's staff ID on it. That cash in Musa's hand is just
him getting back money he's already paid in.

*Point to "Advance left".*

He can never take more cash than he's remitted, and every naira of every remittance is accounted for,
trader by trader. That's how we move on from anyhowness, without leaving anybody out.

*Optional, if time allows: scan a trader who is already PAID. Tap "Take cash to pay ahead", pick
"Next 7 days".*

And a trader who's paid today can hand over cash for the whole week. Every scan until then shows
PAID. It works like a prepaid card, but there's no money stored on it: the levies are simply paid.

> **If it fails:** say "the remittance comes first and caps the cash" and show `/admin/remittances` from an earlier
> run. Never take cash on screen without the SMS appearing.

### Step 4: A judge checks the officer

Would one of you scan this with your own phone camera? It's Officer Musa's ID.

*Hold up the officer QR on the phone.*

Genuine, and active.

*Put the phone down. Switch to `/admin` on the laptop.*

Now I'm the revenue office, and I suspend him.

*Suspend OTT-001. Ask the judge to scan again.*

SUSPENDED, and the office gets a fraud flag. A trader on the street can now catch a fake or
dismissed collector.

> **Warning:** `team13.xtradot.co` currently sits behind a Cloudflare Access login, so a judge's
> own phone may land on a sign-in page. Check on the morning. If it's still there, scan with a
> second phone that's already signed in and say "here's what your phone would show".
> **Afterwards:** reinstate OTT-001, or the rest of the demo shows him suspended.

### Step 5: A fake receipt

Someone shows you a receipt. Is it real?

*Open the public check page and type a made-up receipt number.*

Not genuine. And that attempt is flagged for the revenue office too.

### Step 6: Charged twice

Now say a collector makes Mama Bisi pay again for today.

*Admin, failure drills, "Paid twice for one day", pick Mama Bisi.*

The system sees she's already paid for today. It flags a double charge and puts the money towards
tomorrow. She doesn't lose it.

### Step 7: Break it

Most demos only show you when things go right. Let me break ours.

*Run "withhold a webhook".*

First, the bank's notification that a payment came in never arrives. Our system doesn't wait for
it. It goes and asks the bank directly.

*This takes about twenty seconds. Keep talking while it settles:*

That's the rule bankers care about most. A notification is a hint. We only mark something paid
when the bank confirms it to us directly.

*It settles.*

There. Settled, without the notification.

*Run "replay a webhook".*

Second, the same notification arrives three times. Watch the ledger count.

*Point to the count before and after.*

It doesn't move. One payment, counted once.

*Run "forged signature".*

Third, someone fakes a notification to make it look like they paid. Rejected.

### Step 8: The dashboard

Back at the revenue office.

*Open the dashboard.*

Today's total has gone up. Compliance is up. And this is the line that matters:

*Point to reconciliation.*

Our ledger against the bank's own settlement. The difference is zero naira, zero kobo.

*Switch back to the slides.*

---

## Slide 4: Why LevyPass

Today there are three ways levies get paid.

Cash to collectors gives you no proof. Paper tickets can be printed by anyone. And e-payment
portals do get money to the government, which is real progress. But they do nothing for the
officer standing at the stall, or the trader arguing with a tout.

LevyPass is the only one that closes the loop right there, on the spot.

Why can't someone copy this next month? Three reasons.

Every levy in LevyPass records the law that allows it, so we only collect what's legally owed,
through officers who are authorised to collect it.

The money handling is built the way a bank would build it, which I'll come to next.

And the money moves through Access Bank. We never hold it. We're the technology, not the wallet.

---

## Slide 5: Technology and security

I'll keep this short, because you've just seen most of it working.

The first thing a banker checks is whether you give value before the money is confirmed. We don't.
When the bank tells us a payment arrived, we ask the bank to confirm it. Only then do we record
it, and we record everything in one step: the payment, the ledger, the receipt and the SMS. You
can't end up with a receipt and no money, or money and no receipt.

If the bank is slow and our request times out, we never send the payment again. That's how
people get debited twice. We ask the bank what happened, and keep asking until we know.

Every QR code is digitally signed, so it can't be forged. Every message from the bank has to carry
a valid signature and be less than five minutes old. And the ledger can only be added to. The
database itself refuses any edit or delete.

We use Huawei's AI models to sort trader complaints in English, Pidgin and Yoruba. If the model is
down, a simple keyword rule takes over, so nothing breaks.

On privacy: we keep a name, a phone number and a stall. No BVN. And nothing goes to the bank for
credit unless the trader says yes.

---

## Slide 6: Business model and impact

Traders pay nothing extra. That matters, because most of them are already overpaying.

The council pays us a small fee on each successful collection. That fee comes out of money it's
losing today, so it's paying to recover revenue, not taking on a new cost. We also charge a set-up
fee per market, for QR stickers, officer training and onboarding. Later, we sell analytics to
state revenue agencies.

To give you a sense of size, take one market.

*Point to ₦130m.*

A thousand stalls, each paying five hundred naira a day, for two hundred and sixty trading days.
That's a hundred and thirty million naira a year. Every ten percent of leakage we close puts
thirteen million back in the council's account.

To be clear, that's arithmetic, not a forecast. We'll measure the real starting point in the pilot.

And for the traders paying two or three groups today: they pay once, and they get a receipt that
holds up.

---

## Slide 7: Bank fit and scale

Why should Access Bank care? Three reasons.

Collections. Councils and state revenue agencies hold their levy accounts with Access Bank, with
settlement and reconciliation already built in.

New customers. Every trader who joins arrives with a phone number, a verified stall and a payment
history. That's a way to reach people the bank rarely reaches.

Credit, with consent. A trader who has paid every day for six months has a track record. With
her permission, that can support a small loan or a savings product.

And it doesn't stop at markets. Motor parks, street-trading permits, signage and waste fees all
work the same way.

*Point to the timeline.*

So: today, the full loop runs on the Forge sandbox. Next, a one-market pilot under an agreement
with a council, with a lawyer confirming the legal basis of each levy. Then the whole council. Then
other cities.

---

## Slide 8: Close

Mama Bisi should pay once, get a receipt that holds up, and never have to argue with a fake
collector again.

That's LevyPass. Thank you.

*Only if the public URL is open on the day:* And if you'd like to check us, any trader QR here
works with your own phone camera.

---

## The five-minute cut

Use this if the slot is five minutes in total.

1. Slides 1 to 3 in one minute: name, Mama Bisi in three sentences, the 98% and 38%, the five
   steps in one breath.
2. Demo steps 1 to 3 (register, pay, scan): about one and a half minutes.
3. Demo step 3b, cash with an advance remittance: about forty-five seconds. Approve the remittance before you
   start if time is very tight, and show only the cash tap.
4. Demo step 7, break it: about a minute. Fill the twenty-second wait with the "a notification is
   a hint" line.
5. Demo step 8, reconciliation at zero: twenty seconds.
6. Slides 6 and 7 together in forty-five seconds: traders pay nothing, the council pays per
   collection, ₦130m for one market, why Access Bank gains.
7. The closing line.

---

## Questions the judges may ask

Keep answers to two or three sentences. If you don't know, say so and say how you'd find out.

**"Is this real money?"**
No. It's the Forge bank sandbox, but every call is a real call to it, and you can see them in the
gateway logs. Real money comes in the pilot, under an agreement with a council.

**"What if a trader doesn't have a smartphone?"**
They don't need one. They pay by USSD and get the receipt by SMS. Their LevyPass card is a printed
QR, on the stall or in their pocket, and it's the officer's phone that scans it.

**"What if a trader loses the card, or someone steals it?"**
The trader taps "make a new card" on their phone, or the revenue office does it for them. The old
card stops working at once: any officer who scans it sees CANCELLED CARD and is told not to take
cash against it. The trader gets an SMS every time, so a replacement they didn't ask for doesn't go
unnoticed. And since the card holds no money, a stolen one is worth nothing.

**"Can traders pay by tapping or scanning the LevyPass card?"**
No, on purpose. The card proves who you are and whether you've paid. It holds no money, so a lost
card costs nothing, and LevyPass never holds anyone's money, which would need a licence and would
recreate the leak we're closing. To pay, the trader uses USSD, or pays the officer cash against the
officer's advance remittance, including a week ahead.

**"What about traders with no bank account?"**
They pay the officer cash. But the officer has already paid that money into the government's
account as an advance remittance, approved by the revenue office. So the government is paid
before the cash changes hands, and the officer can never take more cash than he's remitted.

**"What stops an officer from just taking cash and not recording it?"**
The trader. Every cash payment sends an SMS receipt naming the officer, there and then. No SMS
means you haven't paid, and the next scan still shows NOT PAID. Every scan is logged with the
officer and the location, and traders can check an officer's ID themselves.

**"Doesn't the cash ban in the new tax framework rule this out?"**
The government never receives cash. It receives a bank payment, the officer's advance remittance, before any
trader pays. The cash is between the trader and the officer, and it's capped by what the officer
has already paid in.

**"Why would an officer agree to remit in advance?"**
Because that's how it already works for POS agents and airtime sellers in every Nigerian market:
you buy float, then you sell. In a pilot, the council can also pay officers a small commission per
collection out of the fee it saves.

**"The bank charged ₦50 on a ₦500 payment. Isn't that ten percent?"**
That's the sandbox's fee. We don't hard-code fees: we read each one from the bank's response and
book it as its own ledger line, so the council sees exactly what collection costs. In a real
deployment that rate is negotiated between the council and Access Bank. The trader pays exactly the
levy either way.

**"What happens if the bank times out?"**
We never resend, because resending is how people get debited twice. We mark the payment unknown
and keep asking the bank until it gives a final answer.

**"What if a webhook comes twice, or someone fakes one?"**
Each bank event has an ID, and we process it only once. Every webhook needs a valid signature and
must be less than five minutes old. You saw both in the demo.

**"Can someone copy or edit a QR?"**
No. Each QR is digitally signed. In testing, a tampered code was refused.

**"Why didn't you give each trader their own bank account number?"**
We tried. In the sandbox, money paid into those accounts never appeared in any settlement report,
so we couldn't reconcile it to the bank. Bank checkout settles cleanly, so we use that. Per-trader
accounts can come back once the bank's settlement covers them.

**"Is collecting levies like this legal?"**
The Constitution gives councils the job of collecting rates and running markets and motor parks.
Only approved levies can be set up in LevyPass, each one recording its legal basis, and only the
council's own officers or appointed agents can collect. Before the pilot, a lawyer confirms how the
2025 tax acts and the Lagos State laws apply to each levy.

**"Are you a payment company? Do you need a licence?"**
We never hold funds. Money moves through Access Bank and licensed payment providers, so we work as
a technology provider.

**"What data do you keep?"**
Name, phone number and stall. No BVN. Nothing goes to the bank for credit without the trader's
opt-in, in line with the Nigeria Data Protection Act 2023.

**"What does the AI actually do?"**
It sorts trader complaints, in English, Pidgin or Yoruba, so the revenue office sees the urgent
ones first. If the model fails, a keyword rule takes over. No payment ever depends on it.

**"How does this scale past one market?"**
Pages read from our own database and never call the bank directly. All bank traffic goes through
one rate limiter, so a busy dashboard can't flood the bank. Adding a market is configuration, not
new code.

**"How is this different from a state e-payment portal?"**
Portals get the money in, but nothing happens at the stall. LevyPass gives the officer and the
trader proof right there, catches double charging, and lets traders check their collector.

**"Why would a council choose you?"**
It recovers revenue it's losing today, gets a live view of every market, and stops handling cash,
which the new tax framework now requires anyway.

## What not to say

- Don't say it's live with real money or real traders. It's a sandbox build heading for a pilot.
- Don't say each trader gets their own account number. We dropped that (see the question above).
- Don't say the Pidgin and Yoruba text was written by native speakers unless one has checked it by
  then. An AI model wrote it.
- Don't present the ₦130m as a projection. It's an illustration.
- Don't say officers never take cash. They can, but only out of an advance they've already remitted.
- Don't call ours a "float" on stage, except when comparing with POS agents. It's an advance
  remittance, and the balance is the officer's "advance".
- Don't name competitors. Say "e-payment portals".

## The morning of the demo

- [ ] Run `demo:reset` so the amounts match this script (₦2,500 for Mama Bisi).
- [ ] Open the public URL on a judge-style phone. If Cloudflare Access still asks for a login, sign
      in on a second phone and drop the "scan with your own phone" line.
- [ ] Officer phone charged, logged in as `OTT-001`, camera permission granted, and placed within
      reach of the laptop so you can switch between them quickly.
- [ ] Printed trader stickers: one paid, one unpaid. Print one LevyPass card too (admin, "QR stickers
      and cards", LevyPass cards tab) to hold up when you say "a card in her pocket".
- [ ] Laptop tabs ready, in demo order: `/demo`, `/sim`, `/admin`, `/admin/failures`, the dashboard.
- [ ] Backup video on the laptop and on a USB stick.
- [ ] If the cluster is down, run everything from `localhost:3000` and say "we're running it locally
      today", nothing more.
- [ ] After the demo, reinstate OTT-001.
