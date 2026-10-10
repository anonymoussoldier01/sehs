# Reading passages, writing prompts, mocks, guides
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'data', 'native')

reading = {"passages": []}
P = [
 ("The Lighthouse Keeper", "fiction", "The lighthouse stood white against the grey sea. Mara had kept its lamp for eleven years, and she knew every gull by its cry. That night the storm took the radio, the spare bulb, and, worst of all, her certainty. When the small boat appeared between waves, she had only the old oil lamp and her own judgement.",
  [("What does the lighthouse symbolise?", ["Safety","Danger","Isolation","Guidance"], 3, "It guides the boat despite the storm."),
   ("Why is Mara uncertain?", ["She is new","Equipment failed","She is afraid of boats","The sea is calm"], 1, "Radio, bulb and certainty are gone."),
   ("'knew every gull by its cry' suggests?", ["She is lonely","She is observant","She is deaf","She dislikes birds"], 1, "Detail shows long attention."),
   ("Tone of the passage?", ["Comic","Tense but hopeful","Angry","Flat"], 1, "Storm + rescue = tension with hope.")]),
 ("Opinion: Phones in Schools", "opinion", "Banning phones sounds decisive, but it confuses the tool with the behaviour. Phones can distract, yet they can also document experiments, translate words, and time sprints. The fair rule is not a ban but managed use: pouches in class, freedom at lunch, consequences for misuse.",
  [("Author's position?", ["Total ban","Managed use","No rules","Ban teachers' phones"], 1, "Pouches in class, freedom at lunch."),
   ("'confuses the tool with the behaviour' means?", ["Phones are bad","Blame use not object","Tools think","Behaviour is fine"], 1, "Distinguish object vs misuse."),
   ("Which evidence is used?", ["Stats","Examples of uses","Quotes","None"], 1, "Document/translate/time examples."),
   ("Tone?", ["Balanced persuasive","Furious","Joking","Sad"], 0, "Concedes then argues.")]),
 ("Volcanoes Explained", "informational", "Volcanoes form where plates pull apart or collide. Magma rises because it is less dense than rock. Thin, runny lava flows far; thick lava traps gas and explodes. Ash can cool the planet for a year, even as lava rebuilds the land.",
  [("Why does magma rise?", ["It is hot","Less dense than rock","Plates push it","Wind"], 1, "Stated directly."),
   ("Thick lava does what?", ["Flows far","Traps gas, explodes","Cools planet","Forms plates"], 1, "Contrast with runny lava."),
   ("Ash effect?", ["Warming","Cooling","Nothing","More eruptions"], 1, "Ash can cool the planet."),
   ("Main idea?", ["Volcanoes destroy","How/why volcanoes work","Travel guide","History"], 1, "Mechanism explanation.")]),
 ("Poem: Winter Bus", "poetry", "The bus breathes fog. / Windows bloom with frost-flowers. / A girl counts stops like beads. / The city slides past, grey as a sleeve.",
  [("Frost-flowers are?", ["Real flowers","Frost patterns","Drawings","Beads"], 1, "Metaphor for frost."),
   ("Mood?", ["Quiet, watchful","Loud party","Angry","Scary"], 0, "Still images, counting."),
   ("'counts stops like beads' suggests?", ["Prayer/routine comfort","She is lost","She sells beads","She is bored only"], 0, "Simile of habit."),
   ("Which device dominates?", ["Metaphor","Essay","Graph","Speech"], 0, "Fog breath, frost-flowers.")]),
]
for i,(title,genre,text,qs) in enumerate(P*3):
    reading["passages"].append({"id":f"pass-{i+1}","title":title if i<4 else f"{title} ({i//4+1})","genre":genre,"text":text,
      "questions":[{"stem":s,"options":o,"answer":a,"explain":e} for s,o,a,e in qs]})
open(os.path.join(ROOT,'reading.json'),'w').write(json.dumps(reading, indent=1))

persuasive = ["Should selective schools expand to more suburbs?","Should phones be locked away during class?","Should homework be capped at 30 minutes?","Should public transport be free for students?","Should zoos still exist?","Should gaming time be limited by law?","Should school start later?","Should uniforms be abolished?","Should AI helpers be allowed in homework?","Should every suburb get a new library?"]
creative = ["The door that only opened once.","The night the lights went out across the street.","A map found inside a library book.","The last seat on the train.","The garden behind the abandoned house.","A message in a bottle with your name.","The storm that arrived at lunchtime.","The key that didn't fit any lock.","A voice from the vents.","The photograph that moved."]
writing = {"prompts":[]}
for i,t in enumerate((persuasive*4)[:40]):
    writing["prompts"].append({"id":f"pers-{i+1}","kind":"persuasive","prompt":t,"stimulus":"Take a clear position. Give 2-3 reasons with one example each.","plan":["Position in 1 line","2-3 reasons","Example per reason","Call to action"],"targetWords":300,"minutes":20})
for i,t in enumerate((creative*4)[:40]):
    writing["prompts"].append({"id":f"cre-{i+1}","kind":"creative","prompt":t,"stimulus":"Show, don't just tell. Use one strong image per paragraph.","plan":["Who/where in line 1","Problem by line 5","Senses x3","Ending that echoes start"],"targetWords":300,"minutes":20})
open(os.path.join(ROOT,'writing.json'),'w').write(json.dumps(writing, indent=1))

mocks = {"mocks":[
 {"id":"diagnostic-50","title":"Free Diagnostic (50Q)","minutes":40,"strands":["maths","quant","reading","verbal"],"questions":[
   {"strand":"maths","stem":"Simplify 12/18","options":["1/2","2/3","3/4","4/6"],"answer":1,"explain":"Divide by 6."},
   {"strand":"quant","stem":"Next: 2, 4, 8, 16, ?","options":["20","24","30","32"],"answer":3,"explain":"×2."},
   {"strand":"verbal","stem":"Chapter : Book :: Scene : ?","options":["Play","Actor","Stage","Song"],"answer":0,"explain":"Part-to-whole."},
   {"strand":"reading","stem":"'knew every gull by its cry' suggests the keeper is?","options":["New","Observant","Deaf","Afraid"],"answer":1,"explain":"Long attention to detail."}]},
 {"id":"maths-qr-60","title":"Maths + QR Block (60 min)","minutes":60,"strands":["maths","quant"],"questions":[
   {"strand":"maths","stem":"25% of 80?","options":["15","20","25","30"],"answer":1,"explain":"Quarter."},
   {"strand":"maths","stem":"Solve 2x+5=17","options":["5","6","7","8"],"answer":1,"explain":"−5, ÷2."},
   {"strand":"quant","stem":"Next: 3, 6, 11, 18, ?","options":["23","25","27","29"],"answer":2,"explain":"+3,+5,+7,+9."},
   {"strand":"quant","stem":"Venn: 30 students, 18 maths, 15 science, 8 both. Neither?","options":["3","5","7","9"],"answer":1,"explain":"30−(18+15−8)."}]},
 {"id":"reading-vr-55","title":"Reading + VR Block (55 min)","minutes":55,"strands":["reading","verbal"],"questions":[
   {"strand":"verbal","stem":"Synonym of Candid?","options":["Honest","Rude","Shy","Cold"],"answer":0,"explain":"Frank."},
   {"strand":"verbal","stem":"Odd one out: Apple, Banana, Carrot, Grape","options":["Apple","Banana","Carrot","Grape"],"answer":2,"explain":"Only vegetable."},
   {"strand":"reading","stem":"Author favouring managed phone use would support?","options":["Total ban","Pouches in class","No rules","Ban teachers"],"answer":1,"explain":"Compromise position."}]},
 {"id":"mixed-mini-20","title":"Mixed Mini (20Q / 25 min)","minutes":25,"strands":["maths","verbal","quant","reading"],"questions":[
   {"strand":"maths","stem":"BODMAS: 6+3×4?","options":["36","18","24","12"],"answer":1,"explain":"× first."},
   {"strand":"verbal","stem":"Hot : Cold :: Day : ?","options":["Night","Sun","Light","Heat"],"answer":0,"explain":"Antonyms."}]}
]}
open(os.path.join(ROOT,'mocks.json'),'w').write(json.dumps(mocks, indent=1))

guides = {"exam":{"blocks":[{"name":"Mathematics + Quantitative Reasoning","minutes":60,"format":"MCQ, paper booklet, no calculator"},{"name":"Reading + Verbal Reasoning","minutes":55,"format":"MCQ, counts not published, paper booklet"},{"name":"Writing","minutes":40,"format":"2 handwritten tasks (~20 min each)"}],"totalTasks":"2h 35m","dayLength":"~4h with registration + breaks","syllabusCap":"Year 8 curriculum only","selection":"~1,000 Year 9 places; up to 5% principal discretion (verified, vic.gov.au)"},
"schools":[{"name":"Melbourne High School","note":"Boys, South Yarra. Year 9 entry via exam."},{"name":"Mac.Robertson Girls' High School","note":"Girls, Melbourne. Year 9 entry via exam."},{"name":"Nossal High School","note":"Co-ed, Berwick."},{"name":"Suzanne Cory High School","note":"Co-ed, Werribee."}],
"pacing":{"mathsQR":"~90s per Q: 2 passes (easy first, mark-and-return).","readingVR":"~44s per Q: don't linger; evidence-pointer for reading.","writing":"5 plan / 13 write / 2 check per task."},
"plans":{"twelveWeek":["Wk1-2: vocab T1 + maths facts + 1 diagnostic","Wk3-6: VR/QR builders one type/day + weekly mini","Wk7-10: full blocks timed + mistake bank","Wk11-12: 2 full mocks + writing 2x/week + taper"],"crash4Week":["Daily: 30 vocab + 20 VR + 20 QR + 1 passage + 1 prompt plan"]},
"faq":[{"q":"Calculator?","a":"No."},{"q":"How many questions?","a":"ACER doesn't publish counts. Train to minutes."},{"q":"Writing types?","a":"Usually 1 persuasive + 1 narrative/creative in 40 min."}],
"glossary":[{"term":"Analogies","def":"A:B :: C:? means match the relationship."},{"term":"BODMAS","def":"Brackets, Orders, Division/Multiplication, Addition/Subtraction."}]}
open(os.path.join(ROOT,'guides.json'),'w').write(json.dumps(guides, indent=1))
print("packs done")
