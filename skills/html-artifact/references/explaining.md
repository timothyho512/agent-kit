# Explaining

How to decide what the page covers and how to write it, so the reader understands it on the first read.

## Step 0: list the reader's questions before planning

Before the design plan, write out every question a newcomer to this topic would ask, in the order they would ask them.
Start from the basics (what is this, why does it exist, what problem does it solve) and go down to the details, the failure cases, and what it means for the reader's own work.
Expect 15 to 30 questions for a topic of any real size.
Show the list in your reply.

Plan the page so that every question is answered on it, in that order.

## What to cover

The reader uses the page to learn. They cannot ask about something they do not know exists, so a complete page beats a short one that hides gaps.
Short sentences, but not a short page: use as many words as the reader needs.

1. **Background first.** Open with a short section on what the reader needs to know before the rest makes sense. Do not assume it, even if the reader is described as experienced. Define each term the first time it appears.
2. **One idea to hold on to.** Right after the background, state in two or three plain sentences the single idea that makes the rest click.
3. **Why, not only what.** For every part you describe, say why it exists: what would go wrong without it. A part described without its reason is a gap.
4. **Concrete cases.** Walk through real scenarios step by step, including the failure cases: what triggers each one, what happens, and what the reader sees. When there are several scenarios, let the reader pick one and see its steps.
5. **What it means for the reader.** End with what this changes in the reader's own code or work: mistakes to avoid, settings that matter, and how to spot problems.
   After that, close the page with a short "Not covered here" list: the related topics the page left out, one line each, so the reader knows where to dig next.
6. **Do not compress.** Never replace an explanation with a clever summary heading or a slogan. If a sentence only makes sense to someone who already understands the topic, rewrite it or add the missing step.

## How to write each sentence

These rules are about wording. They never justify cutting content the reader needs.

**Writing the copy.** Treat words as design material and never as decoration. Write from the user's side of the screen: name things by what people recognize instead of how the system is built (a person manages *notifications*; they don't manage *webhook config*). Use active voice. Prefer specific to clever. Write plainly, the way a knowledgeable person would talk. Avoid mannered devices: asides set off by dashes, "not X, but Y" framing, colon-then-reveal sentences, scare quotes around invented labels, and stock phrases such as "worth noting" or "honest caveat". Prefer short, direct sentences over compressed or clever phrasing.

**Structure is information.** Structural devices (numbering, eyebrows, dividers, labels) should encode something true about the content instead of decorating it. Numbered markers fit only if the content actually is a sequence.

**Talk like one person to another.** No jargon the page has not explained. Say things coherently and simply.

**Be concrete.**

- Use the real name from the code: say "`UserService` calls `AuthClient.refresh()`", not "the service delegates to the client".
- When something is complex, explain why it is complex. Don't just describe the complexity.
- When something is simple, don't pad it out.
- Use an analogy only when a helpful one exists. Don't force one.
- Be specific: not "this can cause issues" but "the request waits 30 seconds, then fails with `TimeoutError`".
- If you could not confirm something, say so on the page rather than hiding it.

**Make each sentence read one way.**

- One thought per sentence. Split a sentence that carries two. Keep a long sentence that carries one.
- Say who does what: "the server closes the socket", not "the socket is closed".
- Make every "it", "they", and "this" point at one obvious thing. Repeat the noun when in doubt.
- Call each thing by one name everywhere on the page.
- Break up long noun strings: "the proto import budget check script" becomes "the script that checks the proto-import budget".
- Cut words that do no work, and use the everyday word: "use", not "utilize".
- Headings say the point in plain words, in sentence case.
- Numbered lists for sequences, bullets for everything else.
- Mix sentence lengths. Short sentences land a point. Longer ones carry a fact with its condition or consequence.
- A sentence that follows every rule but sounds like a machine wrote it has failed. Fix it another way.

## Content check (after the screenshot check)

Reread the finished page top to bottom as the newcomer, then answer each item in your final reply with where on the page it is, or fix the page first:

1. Every question from Step 0 is answered. List any that are not, and add them.
2. The page opens with a background section, and every technical term is defined the first time it appears.
3. The "one idea to hold on to" comes right after the background.
4. Every part says why it exists.
5. The scenarios, including the failure cases, can be followed step by step, and the reader can pick one when there are several.
6. The page ends with what it means for the reader's own work, followed by the "Not covered here" list.
7. No sentence needs knowledge the page has not given yet. Rewrite only the sentences that fail. Do not shorten the page.
