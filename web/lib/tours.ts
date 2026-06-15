// Guided craft tours — curated journeys, each built around ONE specific
// craft move. This is editorial content (the SEO/habit engine), so the
// pairings should be genuinely true to the move, not loose vibes.

export interface TourSong {
  title: string;
  artist: string;
  note?: string; // why this song belongs to the tour's craft move
}
export interface Tour {
  slug: string;
  title: string;
  move: string; // the craft move, in one line
  blurb: string; // 2-3 sentences
  songs: TourSong[];
}

export const TOURS: Tour[] = [
  {
    slug: "the-beat-switch",
    title: "The beat switch",
    move: "A song that splits itself in two, reframing everything before it.",
    blurb:
      "Some songs don't build — they break. A beat switch cuts the floor out and drops you somewhere new, so the second half re-reads the first. It's the closest pop comes to a plot twist.",
    songs: [
      { title: "Runaway", artist: "Kanye West", note: "the long piano vamp gives way to the vocoder dissolve" },
      { title: "Nights", artist: "Frank Ocean", note: "the literal halfway pivot that splits the album in two" },
      { title: "Bohemian Rhapsody", artist: "Queen", note: "ballad → opera → rock, three songs in one" },
      { title: "Good 4 U", artist: "Olivia Rodrigo", note: "the bridge tears the pop-punk open" },
    ],
  },
  {
    slug: "drums-drop-before-the-hook",
    title: "Drums drop before the hook",
    move: "Everything vanishes for a beat so the chorus slams back as release.",
    blurb:
      "Pull the floor away right before the drop and the return feels like being let go and caught. It's tension and release rendered as pure dynamics — the body feels it before the brain names it.",
    songs: [
      { title: "Dog Days Are Over", artist: "Florence + The Machine", note: "the silence before the harp-and-drums explosion" },
      { title: "Where Is My Mind?", artist: "Pixies", note: "quiet-loud-quiet, the blueprint" },
      { title: "Titanium", artist: "David Guetta", note: "the breakdown that holds you under before the drop" },
    ],
  },
  {
    slug: "the-rhyme-breaks-on-the-loss",
    title: "The rhyme breaks on the loss",
    move: "The pattern that's held all song fails exactly where the meaning does.",
    blurb:
      "When a song teaches your ear to expect a rhyme and then withholds it on the saddest line, the broken pattern IS the grief. Form enacts feeling — you hear the loss as a missing sound.",
    songs: [
      { title: "Hurt", artist: "Johnny Cash", note: "the final wish refuses the chorus it taught you" },
      { title: "Casimir Pulaski Day", artist: "Sufjan Stevens", note: "plainspoken lines that won't resolve" },
      { title: "Re: Stacks", artist: "Bon Iver", note: "the rhyme dissolves as the resolve does" },
    ],
  },
  {
    slug: "euphoria-over-heartbreak",
    title: "Euphoria carrying heartbreak",
    move: "The music throws a party while the words describe the wreckage.",
    blurb:
      "The cruelest trick in pop: a body-moving, major-key production under a lyric that's quietly falling apart. You can't sit down and cry to it — you have to cry standing up, dancing.",
    songs: [
      { title: "Dancing On My Own", artist: "Robyn", note: "a breakup narrated live on the dancefloor" },
      { title: "Heart of Glass", artist: "Blondie", note: "disco shimmer over bitter resignation" },
      { title: "I'm Coming Out", artist: "Diana Ross", note: "joy as armor" },
    ],
  },
];

export function getTour(slug: string): Tour | undefined {
  return TOURS.find((t) => t.slug === slug);
}

// Song of the day — a deterministic rotation through a curated pool, keyed
// on the date so it's stable for everyone within a day.
const DAILY_POOL: TourSong[] = [
  { title: "Ivy", artist: "Frank Ocean" },
  { title: "Dreams", artist: "Fleetwood Mac" },
  { title: "Runaway", artist: "Kanye West" },
  { title: "Hurt", artist: "Johnny Cash" },
  { title: "Everything In Its Right Place", artist: "Radiohead" },
  { title: "Dancing On My Own", artist: "Robyn" },
  { title: "Self Control", artist: "Frank Ocean" },
  { title: "Running Up That Hill", artist: "Kate Bush" },
  { title: "Pyramids", artist: "Frank Ocean" },
  { title: "Heart of Glass", artist: "Blondie" },
  { title: "The Less I Know the Better", artist: "Tame Impala" },
  { title: "Motion Sickness", artist: "Phoebe Bridgers" },
  { title: "Jolene", artist: "Dolly Parton" },
  { title: "Bohemian Rhapsody", artist: "Queen" },
];

export function songOfTheDay(date: Date): TourSong {
  // days since epoch → stable index for the calendar day
  const dayNumber = Math.floor(date.getTime() / 86400000);
  return DAILY_POOL[dayNumber % DAILY_POOL.length];
}
