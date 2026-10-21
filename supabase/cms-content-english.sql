-- Run after homepage-promos.sql and article-cms.sql.
-- Adds English copy to the existing homepage promos and articles without changing Indonesian content.

update public.homepage_promos
set
  eyebrow_en = 'CREATE WITH MU-KOMIK',
  title_en = 'Become a MU-Komik Contributor',
  description_en = 'Have a story, comic, or illustration to share? Join MU-Komik and bring your work to readers.',
  cta_label_en = 'Start creating'
where id = 'f77e7dc1-a146-4df6-90f8-2fe7117f50d8';

update public.homepage_promos
set
  eyebrow_en = 'COMING SOON',
  title_en = '3 New Stories Coming Soon',
  description_en = 'The Last Sky — a fantasy adventure as the world teeters on the brink of collapse. A Letter from the Rainy Season — a heartwarming story about a meeting and a second chance. Signal from the Silent City — a sci-fi mystery uncovering a city’s secrets. Get ready for new stories on MU-Komik!',
  cta_label_en = 'Explore comics'
where id = '154f91b7-43df-4fca-9435-b63b9f8c701f';

update public.homepage_promos
set
  eyebrow_en = 'MU-KOMIK AI MANIFESTO',
  title_en = 'AI for Storytelling. Humans for Meaning.',
  description_en = 'AI helps creators experiment and bring ideas to life. But the vision, decisions, and soul of every story remain human. Read MU-Komik’s perspective on creativity, technology, originality, and the future of comics.',
  cta_label_en = 'Read the manifesto'
where id = '1b3ef809-ed52-46c4-8934-08d252946fd4';

update public.homepage_promos
set
  eyebrow_en = 'MANY APPROACHES, ONE STORY',
  title_en = 'Every Creative Approach Has a Place on MU-Komik',
  description_en = 'From traditional drawing and digital painting to comics made with AI-assisted workflows, MU-Komik welcomes the many ways creators bring stories to life. What matters most is the vision, originality, and human touch behind every work.',
  cta_label_en = 'Explore comics'
where id = 'd7551cb4-2d02-41cb-9485-eaf82ae6d405';

update public.articles
set
  title_en = 'How to Choose the Right Comic: A Beginner’s Guide',
  excerpt_en = 'Not sure where to start reading comics? Explore genres, synopses, art styles, and release formats to find a story that fits your time and tastes.',
  category_en = 'Reading Guide',
  seo_title_en = 'How to Choose the Right Comic | MU-Komik',
  seo_description_en = 'A beginner’s guide to choosing a comic: start with genres and synopses, explore art styles, and find a comfortable way to read.',
  content_markdown_en = $translation$
Want to read comics but not sure which title to start with? The choices can feel endless: action comics with expansive worlds, warm slice-of-life dramas, mysteries full of clues, and fantasy stories with their own rules. The good news is that you do not have to find “the best comic of all time” right away. Just look for a story that fits your mood, schedule, and preferred reading experience.

This guide will help you decide whether a comic is right for you before you begin—without following trends or feeling that you have to like a particular genre.

## 1. Start with the mood, not just the genre label

Genres are useful starting points, but a label does not tell you everything about the reading experience. Two fantasy comics, for example, can have very different pacing, humor, and conflicts. Ask yourself: are you in the mood for something suspenseful, lighthearted, romantic, funny, or moving?

If you are not sure, choose based on the mood you want today. A story with a simple conflict and short chapters might suit a quick break. If you want to spend more time in a fictional world, an ongoing adventure could be a good fit. Your tastes can change from one day to the next, too.

## 2. Read the synopsis to find the central conflict

A good synopsis usually introduces the characters, the starting situation, and the problem they will face—without giving away every surprise. From there, see whether the central conflict interests you. Are you curious about the character’s choices? Does the problem feel familiar, or does it open up a world you want to explore?

Do not look only for summaries that sound “epic.” A slice-of-life story can be compelling if the relationships make you want to know what happens next. On the other hand, an exciting premise may not suit you if the storytelling itself does not feel right.

## 3. Get to know the characters and what they are striving for

The main character is often one reason readers stick with a story. They do not have to be good or immediately likable. Usually, though, something makes us want to understand their choices: a clear goal, an interesting relationship, a relatable flaw, or a change we want to see.

When reading the description or first few pages, consider a few simple questions: what does this character want, what stands in their way, and why do I want to know what happens next? If the answer is not clear yet, give the story a little time. But you do not have to push yourself if the characters and conflict simply do not interest you.

## 4. Give the art style and storytelling a chance

Comics tell stories through images as well as words. Notice how the panels shape movement and time, how expressions convey emotion, and how much information comes through dialogue. Simple, detailed, expressive, and experimental art styles can all work well—it depends on the story and your preferences.

Try reading a few pages instead of judging only by the cover. Is the panel sequence easy to follow? Does the atmosphere come through? Do the dialogue and artwork complement each other? These questions are more helpful than searching for one supposedly “best” style, because no visual approach works for every reader.

## 5. Consider the story’s length and release format

Before starting a long series, consider whether you are ready to follow an ongoing story. The number of available episodes, update schedule, and completion status can help set expectations. If you want a story you can finish in one sitting, look for a completed title or a short-story format.

Readers do not have to keep up with the newest episode of an ongoing comic. You can save an interesting title and start when you have time. If you read on a phone, also consider display comfort, text size, and panel layout so your reading session does not become tiring.

## 6. Choose a way to read that supports the creator

When available, read through official channels or platforms authorized to publish the work. In addition to supporting creators and the people who handle publication, official channels provide clearer information about titles, creator credits, episode order, and story status.

If you find a comic you like, support does not always have to mean making a purchase. Sharing the official link, leaving a thoughtful review, or recommending it to a friend can help new readers discover the work. Do not repost pages or files without permission.

## 7. Give yourself permission to stop or try again later

Reading should be enjoyable, not a to-do list. If a comic is not a good fit, you can stop, save it for later, or return when your mood changes. There is no rule that says you have to finish every title.

On the other hand, do not rush to judge a story after one panel if you are still curious. Try a few pages or one episode to see how the premise develops. Set a comfortable limit for yourself—and do not feel guilty if your answer is still “not for me.”

## A quick checklist before you start

- Does the mood or conflict in the synopsis catch my interest?
- Do I want to learn more about the main character?
- Do I enjoy the art style and panel flow?
- Does the length and release status fit my schedule?
- Am I reading from an official source?

You do not have to answer “yes” to everything. One reason to feel curious is enough to give it a try.

## Frequently asked questions

### Which comics are best for beginners?

There is no single title that works for everyone. Start with themes from films, books, or games you already enjoy, then read the synopsis and a few pages to see whether the storytelling suits you.

### Do I have to start a comic from episode one?

For an ongoing story, the first episode usually introduces the characters and conflict. If a title has an official reading order or side stories, follow the guidance on its page.

### How many episodes should I try before deciding?

There is no required number. Some readers know after a few pages; others want to give it one or two episodes. It is perfectly reasonable to stop when you are no longer enjoying the experience.

### How can I discover new local comics?

Explore official platform catalogs, read synopses, check creator information, and ask other readers for recommendations. When you find a title you like, share its official link so more people can read it.

## Enjoy finding your next story

Choosing a comic does not have to be complicated. Start with something that makes you curious, read at a comfortable pace, and follow stories that feel meaningful to you. The first title you try may not become a favorite—but it could lead you to a new world and creators you have never encountered before.
$translation$
where id = 'b26000ef-1a90-42ea-a77b-3ec2a48bfd0d';

update public.articles
set
  title_en = 'How to Read Comic Panels: Understanding Sequence and Story Flow',
  excerpt_en = 'Having trouble following panel order or catching important details? Learn to read panel direction, speech balloons, visual pauses, and vertical comics more comfortably.',
  category_en = 'Reading Guide',
  seo_title_en = 'How to Read Comic Panels: Sequence and Story Flow | MU-Komik',
  seo_description_en = 'A guide to comic panel order, reading direction, speech balloons, sound effects, visual pauses, and vertical comics.',
  content_markdown_en = $translation$
Comics tell stories through two things at once: images and sequence. Sometimes an expression or a small change in the background communicates something that dialogue never explains. Reading a comic is not just looking at pictures one by one—we follow how panels shape movement, time, and attention.

If you have ever jumped to the wrong panel, lost track of who is speaking, or wondered where to scroll next, you are not alone. Formats and reading habits vary from title to title. This guide covers visual cues that can help, without assuming every comic follows the same rules.

## 1. Check the reading-direction cues first

Do not assume every comic is read in the same direction. Many page-based comics flow from left to right, while some works read from right to left. Digital vertical comics are usually followed by scrolling downward, but the panel arrangement on each screen still matters.

Follow any reading instructions provided by the platform or on the comic’s page. A print edition may also explain its reading direction on an opening page. When in doubt, look at the position of the first panel and the topmost speech balloon: both often hint at where to begin.

## 2. Follow the panel flow, not just the most eye-catching image

A panel is a frame that divides a story into moments. On a page with multiple panels, your eyes generally follow the sequence set by the page layout and the work’s reading direction. But layouts can be deliberately dynamic: panels may stretch, stack, or cross frame boundaries to emphasize movement or a change in mood.

Start with the panel that clearly opens the scene, then notice how it relates to the panels around it. If the layout is unusual, take your time. Look for the most logical continuation based on position, expressions, movement, and dialogue. The largest image is not always the first panel—it may be the page’s climactic moment.

## 3. Use speech balloons as clues, not your only focus

Speech balloons show conversations, but their placement within a panel can also help establish the order of speech. In a scene with several characters, the first balloon is usually placed according to the reading direction before the next one. A balloon’s tail often points to the speaker.

Narration boxes, character thoughts, and dialogue may serve different purposes. Try to notice who is speaking, to whom, and what is happening in the image. If following only the dialogue makes the scene confusing, pause and look at the expressions, lines of sight, and characters’ positions.

## 4. Pay attention to the space between panels

The empty space between panels—often called the gutter—is more than decoration. Readers often infer for themselves what happened between two moments. One panel might show a character raising a hand, while the next shows the result. The action connecting them may never be drawn directly.

The size of the gaps, the shape of the frames, and the distance between panels can also affect the sense of pace. A sequence of small panels can make movement feel gradual. One large panel surrounded by open space can make a moment feel important or quiet. These are not fixed codes; notice how the visual choices work with the scene and narration.

## 5. Give wordless panels time

Silent panels often contain important information: a change in expression, the atmosphere of a place, the distance between characters, or the passage of time. Do not feel that you have to move on immediately just because there is no text. Ask what has changed since the previous panel and what the character might be feeling.

A visual pause can make a surprise more powerful or give readers time to absorb an emotion. Slowing down at moments like these can make the story easier to understand—and sometimes more moving.

## 6. Recognize sound effects and lettering in the art

Sound effects may appear as large letters, special shapes, or part of the illustration. Their size and shape often hint at volume, speed, or the nature of a sound. Writing on signs, screens, objects, and backgrounds can also help explain the setting and situation.

You do not have to translate every sound effect exactly to understand a scene. Notice its visual role: does it mark an impact, footsteps, an ambient sound, or a sudden change? If the publisher or creator provides official notes, use them to read text that is difficult to make out.

## 7. Adjust your reading for digital formats

Page-based comics and vertical-scroll comics create rhythm in different ways. On a page, several panels may be visible at once, allowing you to compare moments directly. In a vertical format, the space before the next panel can create a pause or build suspense.

When reading a vertical comic, scroll at a comfortable pace. If you scroll too far at once, related panels may no longer be visible together. On a page with many panels, zoom in only when needed to read details, then return to the full view to understand the composition and sequence.

## 8. What can you do when the flow feels confusing?

Pause and look again at the page or the last few panels. Find the starting point, the characters’ direction of movement, the order of speech balloons, and the change from one moment to the next. Often, the clue you missed is in an expression or background detail, not in the text.

If it is still unclear, go back one page or one screen of scrolling. You have not failed to understand the story; an experimental layout may be inviting you to interpret its flow. Read an official copy at a high enough image quality so that text and panel details are not lost.

## A short reading exercise

On the next page you read, try noticing these three things:

1. Find the panel that begins the scene and work out its reading direction.
2. Follow the speech balloons while noticing who is speaking and what the other characters are doing.
3. Look for one change that happens between two panels, including a change that is implied rather than shown directly.

This is not a test with rules. It is simply practice in following images and text as one sequence.

## Frequently asked questions

### Are all comics read from left to right?

No. Reading direction depends on the format and edition. Follow instructions from the publisher, creator, or platform, especially when the page uses an unfamiliar layout.

### Why are some panels silent?

Wordless panels can show expressions, atmosphere, a change in time, or an emotional pause. They are still part of the storytelling even when there are no words.

### What should I do if I do not know which balloon to read first?

Check the work’s reading direction, the balloons’ positions in the panel, and which character each tail points to. Follow that order along with your eye movement across the panels, rather than choosing only the largest balloon.

### Should I read vertical comics quickly?

No. Scroll at a pace that feels comfortable. Vertical spacing and panel changes can be part of the rhythm, so pausing can help you understand a scene.

## Read with a closer eye for the story

The more you read, the easier it becomes to recognize how panels, pauses, dialogue, and images work together. There is no single correct speed for everyone. Follow the cues in the work, pay attention to visual details, and enjoy the rhythm the creator has built.
$translation$
where id = '987e1d64-ea11-4364-beaf-0421aa0f3c74';

update public.articles
set
  title_en = 'R.A. Kosasih: The Master Who Brought Wayang Stories to Comics',
  excerpt_en = 'Meet R.A. Kosasih, the comic artist who turned the Ramayana, Mahabharata, and wayang traditions into popular comics—and whose visual legacy continues to inspire Indonesian comics.',
  category_en = 'Indonesian Comic Figures',
  seo_title_en = 'R.A. Kosasih: The Father of Indonesian Comics and His Legacy',
  seo_description_en = 'Discover the life and legacy of Indonesian comic artist R.A. Kosasih, known for adaptations of the Ramayana, Mahabharata, wayang stories, and Sri Asih.',
  content_markdown_en = $translation$
# R.A. Kosasih: The Master Who Brought Wayang Stories to Comics

The name R.A. Kosasih is closely tied to the history of Indonesian comics. He is often called the **Father of Indonesian Comics**—an honorific reflecting the scale of his influence, not a claim that he single-handedly created the comic tradition in the archipelago. Among his many works, adaptations of wayang stories and epics such as the *Ramayana* and *Mahabharata* gave stories long rooted in oral tradition and performance a new form: page after page of comics.

Why are Kosasih’s works still discussed as reading habits and visual tastes change? The answer is more than nostalgia. His work shows how old stories can be retold through a popular medium without losing the characters, conflicts, and imagination that have kept them alive across generations.

## From Raden Ahmad Kosasih to a major name in comics

Raden Ahmad Kosasih was born in Bogor on April 4, 1919, and died on July 24, 2012. He worked as both a writer and comic artist. His career developed at a time when Indonesian comics were finding their readers and their own publishing formats.

Calling Kosasih an important figure does not mean Indonesian comic history begins and ends with one person. Comics grew through the work of many writers, illustrators, publishers, and readers. Kosasih’s name stands out because of his productivity and the range of stories he drew, especially wayang tales and epics familiar to many people.

## Why do wayang stories work well as comics?

Wayang offers a rich collection of characters, conflicts, family ties, journeys, and struggles over values. Before appearing as comics, these stories were already known through many forms of storytelling and performance. Kosasih brought some of that richness into sequences of images and dialogue.

This change of medium matters. A performance takes place before an audience at a particular time; a comic can be read alone, reread, kept, and shared. Panels divide scenes into visual moments. Character expressions, composition, and text work together to help readers follow the story.

An adaptation like this is not simply a performance copied onto paper. Every retelling chooses what to emphasize, sets its pace, and decides how readers will encounter the characters. This is where a comic artist’s skill becomes clear: the plot must work through images while preserving the heart of the story.

## The Ramayana and Mahabharata in visual form

Kosasih is widely known for comics based on the *Ramayana* and *Mahabharata*. These epics have many characters and storylines, giving readers adventures, intrigue, loyalty, family conflict, and moral choices across a sweeping narrative.

Bringing stories of this length into comics takes careful adaptation and pacing. Readers need to know who is involved, understand the relationships between characters, and see why a decision changes the course of events. Images give faces and movement to names readers may previously have encountered only through stories or performances.

These works also became a way for readers to rediscover tradition. Readers unfamiliar with wayang stories can begin with a comic; those who already know them can enjoy a different visual interpretation. Comics do not replace every earlier form of storytelling, but they add another way to encounter it.

## Sri Asih and the imagination of local heroes

Beyond epic tales, Kosasih is also known for *Sri Asih*, a woman with extraordinary powers who is often discussed in the history of early Indonesian superheroes. A character like Sri Asih matters because it shows that comic-book heroism does not have to draw its settings and characters from abroad.

Comic heroes can grow from local language, surroundings, and readers’ imaginations. Works like this raise a question that remains relevant for comics today: how can creators make a character feel connected to local experience while still appealing to a wide range of readers?

Publication histories and claims about who was “first” in a genre can vary depending on sources and definitions. It is therefore more precise to describe *Sri Asih* as an important work in discussions of Indonesian superheroes, rather than making one superlative claim the whole story.

## An art style in service of the story

Kosasih’s work is widely associated with black-and-white art. Without color, lines, shapes, expressions, and composition play a major role in setting the mood and helping readers follow a scene. This visual choice also reminds us that comics do not depend on complex technology or effects to be powerful.

A page moves not through isolated images but through the relationship between one panel and the next. A character changing position, an expression shifting, or a scene being framed in a particular way can carry information and build emotion at once. Readers fill the gaps between panels by imagining what happened.

Reading older comics with attention to how they work—instead of only comparing their appearance with modern comics—helps us see the artistic decisions behind them. Every era has its own printing technology, reading habits, and visual expectations.

## A legacy greater than nostalgia

Older works may be remembered because they bring readers back to childhood. But Kosasih’s legacy can be read more broadly: as proof that local stories offer strong material for popular media, and that comics can bridge tradition and new readers.

That legacy is not a blueprint to copy exactly. Today’s comic artists can take inspiration from the courage to adapt familiar stories, then choose their own perspective and visual language. Tradition stays alive not by being frozen in place, but by being read, discussed, and retold responsibly.

Remembering Kosasih also invites us to value the ecosystem that brings comics to readers: creators who write and draw, publishers who distribute the work, and readers who keep the stories in conversation. Great figures matter, but comic history is always built together.

## How to start exploring R.A. Kosasih’s work

If you would like to explore his work, start with editions available through publishers, libraries, bookstores, or other legitimate collections. Check the edition information, since older works may be reprinted, edited, or arranged differently.

As you read, you might notice:

- How characters are introduced and distinguished through the art.
- How panels organize busy or action-filled scenes.
- Which parts of a traditional story are emphasized.
- How reading the comic differs from hearing or watching the same story.

This approach makes reading feel like an encounter with the history of the medium, rather than simply working through a list of titles.

## Frequently asked questions

### Why is R.A. Kosasih called the Father of Indonesian Comics?

The title honors his significant influence and contribution to the development of Indonesian comics. Comic history involves many people, so the honorific is best understood as recognition of Kosasih’s important role—not as a claim that there was only one pioneer.

### Which works made R.A. Kosasih widely known?

Among other works, he is known for adaptations of the *Ramayana* and *Mahabharata*, traditional stories, and *Sri Asih*. Available titles and edition arrangements may differ between publishers and reprints.

### Why are wayang adaptations in comic form important?

Comics offer a visual, accessible way to encounter traditional stories. Adaptations also show how a story can move between media and reach readers who may not have encountered it through performance.

### Is R.A. Kosasih’s work still relevant to readers today?

Yes, especially as a way to understand the history of local comics and the possibilities for adapting Indonesian stories into popular media. Readers can also see how artistic techniques, formats, and publishing habits differ across eras.

## A bridge between stories and generations

R.A. Kosasih is remembered not only for drawing great characters, but also for helping bring those stories to life on comic pages. Through adaptation, readers can meet stories whose roots reach far beyond the comic medium itself.

That is one of his most important legacies: showing that Indonesian comics can grow from the richness of their own stories. Every generation of creators and readers has a chance to continue that conversation in a new way.
$translation$
where id = '101e19e5-4d33-44d4-9c7e-fc4d701d0bea';

update public.articles
set
  title_en = 'MU-Komik Kids Mode: A Reading-Space Guide for Children and Parents',
  excerpt_en = 'Learn about MU-Komik Kids Mode: its curated children’s comic catalog, genre filters, age labels, and how parents can set a PIN and support reading time.',
  category_en = 'Reader Guide',
  seo_title_en = 'MU-Komik Kids Mode: A Reading-Space Guide for Children and Parents | MU-Komik',
  seo_description_en = 'Learn about the curated children’s comic catalog, genre filters, age labels, and ways parents can manage a PIN and support reading time in MU-Komik Kids Mode.',
  content_markdown_en = $translation$
## Read comics together with more guided choices

Children enjoy stories in many different ways: some love adventures, some like meeting animal characters, and others want to read about everyday life. **Kids Mode** on MU-Komik helps families explore a comic catalog curated for a child-friendly experience.

This mode is not a substitute for parental guidance. Here is how it works and what to know before you start reading.

## What changes when Kids Mode is on?

When Kids Mode is active, the homepage shows stories selected from a catalog approved for the mode. Comic cards may include an age-range label when that information is available. Reading terms are also simplified—for example, episodes may be called “Parts” or “Stories”—to make them easier for children to understand.

Children can choose a genre using illustrated buttons, then open a comic and its available parts. Treat age labels as a starting point, not the only basis for deciding whether a story is right for a particular child.

## How to turn on Kids Mode

1. Open the MU-Komik homepage and select the **Kids Mode** button at the top.
2. The first time you set it up, a parent creates a six-digit PIN and enters it again to confirm. Kids Mode turns on once the PIN is saved.
3. On later visits, a parent can turn on the mode using the same button.
4. To turn it off and return to the general view, enter the parent PIN.

Choose a PIN that is difficult to guess and keep it somewhere safe. Do not share it in front of children or send it in a message. The PIN controls switching Kids Mode; continue to supervise children as they use the device and read comics.

## Finding a story

Start with the homepage catalog. Choose a genre that interests the child, or use search if available. Open a comic card to see its details and the list of readable parts. If a title displays an age label, use it as a point of discussion with the child.

Reading together can also be a chance to ask questions: which character do you like, how does the character feel, and what might happen next? Simple conversations like these help children connect stories with their experiences and the values they are learning.

## What should parents know?

Kids Mode filters choices using the catalog of comics approved for the children’s mode. Available titles and age information may vary. Curation and age labels provide context, but cannot guarantee that every story is suitable for every child, family, or situation.

Parents should review unfamiliar comics first, consider the child’s age and sensitivities, and invite the child to talk about what they read. Some account pages and general features are also unavailable while Kids Mode is active; turn it off with the parent PIN if you need to access them.

## Start with one story

Choose a comic that catches the child’s attention, review its labels and information, and read together. Kids Mode helps families start with a more guided selection of stories—while the final decision about what is appropriate remains with parents and children.

Enjoy finding a favorite story on MU-Komik!
$translation$
where id = '4ca16635-e799-4da6-9a6b-d27526d30783';

update public.articles
set
  title_en = 'Audio Comics on MU-Komik: Listen While You Read',
  excerpt_en = 'Some comic episodes on MU-Komik include audio you can play while reading. Learn about player controls, synchronized subtitles, and how to find episodes with audio.',
  category_en = 'Reader Guide',
  seo_title_en = 'Audio Comics on MU-Komik: Listen While You Read | MU-Komik',
  seo_description_en = 'Some MU-Komik comic episodes include audio to play while reading. Learn about player controls, synchronized subtitles, and how to find episodes with audio.',
  content_markdown_en = $translation$
## Read comics with audio

Comics are enjoyed through images and stories. For selected episodes on MU-Komik, creators can also provide audio so you can listen while following the comic pages. This gives you another way to enjoy a story—without making every title the same experience.

## Audio is available for selected episodes

Audio is not automatically available for every comic or episode. The player appears on the reading page of episodes that include audio. If you do not see an audio player, that episode may not have audio. Open another episode from the same comic to check whether it is available there.

## Listen while following the pages

On the reading page, use the play or pause button to control the audio. The timeline shows the audio’s position and duration; move the slider to jump to the part you want to hear. You can continue following the comic artwork while the audio plays.

For episodes with subtitles and page mapping, subtitle text follows the audio timing and can be paired with the relevant page. This depends on whether subtitle files and page mapping have been prepared for that episode. Audio may also be available without synchronized subtitles or pages.

## How to start listening

1. Choose a comic and open one of its available episodes.
2. If the episode has audio, the player will appear on the reading page.
3. Press play to start listening.
4. Use the pause button or timeline to control playback.
5. If subtitles are available, follow the text and pages shown as the audio plays.

If the audio does not load or play, check your internet connection and try again. Audio availability and content depend on the files prepared for each episode.

## For creators

Creators with audio-upload access can add MP3 audio to an episode through the comic editor. SRT subtitles and cue-to-page mapping can be prepared so that the text follows the corresponding audio timing and page. Check the audio, subtitles, and mapping before publishing the episode.

## Choose a comfortable way to read

You can read a comic as usual, or play audio when you want to listen while following the story. Since episodes may have different features, check the reading page to see whether audio and subtitles are available. Enjoy reading and listening on MU-Komik!
$translation$
where id = '81a33b44-0047-49b1-bcd9-9a425f4e7c1d';

update public.articles
set
  title_en = 'Kho Ping Hoo and Indonesia’s Craze for Martial Arts Stories',
  excerpt_en = 'How did Kho Ping Hoo’s martial arts stories captivate Indonesian readers? Explore serialization, reading-room culture, and their lasting trail from the 1960s through the 1980s.',
  category_en = 'History & Culture',
  seo_title_en = 'Kho Ping Hoo and Indonesia’s Craze for Martial Arts Stories',
  seo_description_en = 'Explore the heyday of Kho Ping Hoo’s martial arts stories, the culture of waiting for serialized fiction, reading rooms, and his devoted readers in Indonesia.',
  content_markdown_en = $translation$
## When readers waited for the next installment

The name Kho Ping Hoo often brings to mind martial artists, silat schools, and long-running adventures. But one distinction matters: Kho Ping Hoo’s work was first known as **serialized martial arts fiction in prose**, not as illustrated comics. Some of his stories were later adapted or referenced by comic artists, but the form that first made his name was fiction published in magazines and books.

Asmaraman Sukowati Kho Ping Hoo began writing martial arts stories in 1959. His first story, *Pedang Pusaka Naga Putih* (*The White Dragon Heirloom Sword*), was written for *Teratai* magazine. Readers’ response led to the story being serialized in several publications. From the beginning, this continuing format brought readers back to unfinished characters and conflicts—and left them waiting for the next installment.

## From magazine serials to reading rooms

The height of his stories’ popularity is often placed between the 1960s and 1980s. Readers waited for the next part written by Kho Ping Hoo; some borrowed books from rental shops or reading rooms, while others bought volumes at bookstores. Reading did not happen only at home: the same book could pass from hand to hand and become part of a shared reading habit.

The physical format shaped the experience, too. A 2013 *Kompas* report described his books as small—about 14 × 11.5 centimeters—with roughly 64 pages per volume. Their compact size and stories divided across many volumes made them easy to carry, borrow, or collect a little at a time.

The same report quoted publisher CV Gema as saying that a single print run of **one volume** of *Pendekar Super Sakti* (*The Mighty Warrior*) once reached 12,500 copies. That figure refers to the print run for one edition, according to the publisher’s source; it is not proof that every copy sold, nor is it a sales figure for the entire series. This distinction matters so that the scale of the story does not turn into an exaggerated number.

## Story worlds that cross settings

The Indonesian Literature Encyclopedia notes that Kho Ping Hoo drew on Chinese and Javanese history and cultural traditions. His martial arts world should therefore not be read as having only one cultural influence. He shaped these story materials into popular adventures in Indonesian, with characters, conflicts, and imagined worlds that readers from many backgrounds could follow.

Curiosity about the characters’ fate, battles between good and evil, and the habit of waiting for the next installment are some reasonable ways to understand the stories’ appeal. That does not mean every reader had the same experience or reasons. Available historical sources document devoted readers and how the books circulated, but do not provide a complete survey of who read them.

## Why are the stories still remembered?

Kho Ping Hoo died in 1994, but reports about his publisher and devoted readers show that the stories continued to be sought out after their peak. Their influence also reached beyond the page: some appeared in stage performances, radio broadcasts, films, and comic adaptations. For today’s readers, discovering his work offers a way to look at Indonesian popular culture—including how serialized stories, bookstores, rental libraries, and reading rooms once brought each other to life.

Perhaps this is the most tangible part of the legacy: not only the many adventures in the martial arts world, but the reading habit built one installment at a time. Before stories could scroll endlessly on a screen, readers waited for the next volume to arrive.

## Sources and further reading

- [“Kho Ping Hoo (1926—1994)” — Indonesian Literature Encyclopedia, Language Development and Fostering Agency](https://ensiklopedia.kemendikdasmen.go.id/sastra/artikel/Kho_Ping_Hoo).
- [Frans Sartono, “Gema Dunia Persilatan Kho Ping Hoo” — *Kompas*, September 22, 2013](https://muda.kompas.id/baca/2013/09/22/gema-dunia-persilatan-kho-ping-hoo/).
- [“Mengenang Kho Ping Hoo, Penulis Cerita Silat Legendaris Indonesia” — *Kompas.com*, July 22, 2020](https://www.kompas.com/tren/read/2020/07/22/080000965/mengenang-kho-ping-hoo-penulis-cerita-silat-legendaris-indonesia-/).
$translation$
where id = 'c3bbcaab-db82-476e-a10d-26fdbd1a5490';

notify pgrst, 'reload schema';
