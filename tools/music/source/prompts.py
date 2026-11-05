import json
MOODS = {
 "Rainy Twilight": ("reflective but comforting", "Felt piano, soft harp, muted strings, distant celesta", "R"),
 "Golden Garden": ("optimistic and sunlit, not hyperactive", "Plucked strings, harp, flute, warm piano, light woodwind", "G"),
 "Starlit Night": ("spacious and celestial without ominous darkness", "Celesta, glassy pads, soft harp, distant strings", "S"),
 "Winter Refuge": ("sheltered and hopeful, never holiday-jingle cliche, no sleigh bells", "Warm cello, soft piano, muted harp, restrained music-box bells", "W"),
}
TRACKS = {
"R":[("Lanterns Against the Rain","gentle descending felt piano theme, slow 72 BPM feel"),
("The Window Keeps Our Secrets","intimate harp arpeggios with soft sustained strings"),
("A Kettle at Dusk","playful warm celesta and piano dialogue, light and tender"),
("Lavender on the Canvas","airy unhurried woodwind melody over harp"),
("Little Rivers on the Roof","repeating delicate felt piano ostinato, no rain sound effects"),
("The Last Dry Cushion","whimsical pizzicato strings with felt piano"),
("Tea Before the Thunder","calm lyrical melodic strings, no thunder, no dramatic build"),
("Violet Hour","luminous harp melody over suspended harmonies"),
("Pages in the Lamplight","music-box-like celesta, very restrained and sparse"),
("Safe Until Morning","tender closing theme with a soft loop-friendly ending")],
"G":[("Honeylight on the Leaves","buoyant acoustic chamber melody, moderate tempo"),
("The Sun Found the Teapot","cheerful soft pizzicato strings"),
("Butterflies at the Window","lilting flute and harp in a gentle sway"),
("A Pocketful of Petals","delicate bell-like accents over light plucked strings"),
("The Garden Knows Your Name","warm lyrical piano theme"),
("Clover and Curiosity","gentle playful woodwinds, clarinet and flute trading phrases"),
("Afternoon in Bloom","flowing harp and legato strings"),
("Apricot Sunbeams","soft rhythmic plucked strings and guitar-like plucks, no drums"),
("The Friendly Breeze","drifting flute motif over warm harp"),
("Stay for Another Cup","serene golden reprise, slow and settled")],
"S":[("Constellations in a Teacup","celesta and harp melody, twinkling and gentle"),
("The Moon's Small Library","hushed felt piano and soft strings"),
("A Thousand Quiet Stars","shimmering sustained harmonies, slow evolving chords"),
("Silver Petal Waltz","gentle 3/4 waltz chamber miniature"),
("The Night Has Soft Edges","warm ambient instrumental, soft pads and distant harp"),
("Orbit of the Fireflies","delicate playful celestial celesta motif"),
("Midnight Without Hurry","very slow sparse felt piano"),
("The Lantern Remembers","recurring lyrical theme carried by soft harp"),
("Wishes Above the Canvas","luminous woodwind and celesta duet"),
("Until the Stars Go Home","comforting nocturne with a gentle final cadence")],
"W":[("Snow Outside, Tea Inside","warm piano and cello duet"),
("The Wool Blanket Waltz","soft 3/4 waltz melody"),
("Hearthlight","low strings and felt piano, glowing and close"),
("Frost on the Windowpane","delicate celesta sparkles over soft strings"),
("A Chair Beside the Fire","intimate slow chamber tune"),
("The Quietest Snowfall","sparse harp over soft ambient strings"),
("Mittens for a Familiar","playful plucked strings, light and warm"),
("Warmth Between Worlds","hopeful lyrical cello melody"),
("The Long Blue Evening","reflective solo piano nocturne"),
("Here, You Are Welcome","gentle thematic finale, warm full chamber close")],
}
DUR = 180
def build():
    out=[]
    for mood,(feel,palette,code) in MOODS.items():
        for i,(title,concept) in enumerate(TRACKS[code],1):
            p=(f"Original instrumental cozy fantasy chamber composition for Magical Tea Tent, {mood.lower()} mood, {feel}, {concept}. "
               f"Hand-painted storybook sanctuary atmosphere. {palette}. Gentle expressive melody, restrained soft dynamics, sparse arrangement, "
               f"no vocals or spoken words, no heavy percussion, no abrupt transitions, no copyrighted melodic references. "
               f"Suitable as low-volume looping background for a peaceful VR tea game. Target {DUR//60} minutes, soft fade-in beginning and gentle resolved ending, distinct from other playlist tracks.")
            out.append(dict(id=f"{code}{i:02d}",title=title,mood=mood,prompt=p,target_duration_s=DUR))
    return out
if __name__=="__main__":
    json.dump(build(),open("manifests/prompts.json","w"),indent=1); print(len(build()))
