export const interactiveSounds = [
  {
    id: "laugh",
    label: "Tertawa",
    creator: "MLaudio",
    source: "https://freesound.org/people/MLaudio/sounds/625686",
    license: "CC0 1.0",
    url: "https://cdn.freesound.org/previews/625/625686_6890478-hq.mp3",
  },
  {
    id: "cry",
    label: "Menangis",
    creator: "galora",
    source: "https://freesound.org/people/galora/sounds/319019",
    license: "CC0 1.0",
    url: "https://cdn.freesound.org/previews/319/319019_3992660-hq.mp3",
  },
  {
    id: "cheer",
    label: "Gembira",
    creator: "zut50",
    source: "https://freesound.org/people/zut50/sounds/162395",
    license: "CC0 1.0",
    url: "https://cdn.freesound.org/previews/162/162395_2645723-hq.mp3",
  },
  {
    id: "magic",
    label: "Magic",
    creator: "newagesoup",
    source: "https://freesound.org/people/newagesoup/sounds/351408",
    license: "CC0 1.0",
    url: "https://cdn.freesound.org/previews/351/351408_4067257-hq.mp3",
  },
  {
    id: "impact",
    label: "Benturan",
    creator: "kyles",
    source: "https://freesound.org/people/kyles/sounds/452596",
    license: "CC0 1.0",
    url: "https://cdn.freesound.org/previews/452/452596_612689-hq.mp3",
  },
] as const;

export type InteractiveSoundId = (typeof interactiveSounds)[number]["id"];

export function getInteractiveSound(soundId: string | null) {
  return interactiveSounds.find((sound) => sound.id === soundId) ?? null;
}
