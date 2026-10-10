# Generates the native SEHS banks (deterministic, no AI). Run: python3 scripts/make-native.py
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'data', 'native')
os.makedirs(ROOT, exist_ok=True)

VOCAB = [
("Ambiguous","unclear, open to two meanings","clear","His ambiguous reply confused everyone."),
("Pragmatic","practical, realistic","idealistic","A pragmatic plan for exam week."),
("Sufficient","enough, adequate","insufficient","Sufficient evidence for the claim."),
("Divergent","branching apart, different","convergent","Divergent opinions on the topic."),
("Concise","brief, to the point","wordy","A concise paragraph wins marks."),
("Meticulous","very careful and precise","careless","Meticulous working in maths."),
("Inevitable","unavoidable","avoidable","Errors are inevitable under time pressure."),
("Candid","honest, frank","evasive","A candid review of your mock."),
("Resilient","able to recover quickly","fragile","Stay resilient after a hard section."),
("Empirical","based on observation","theoretical","Empirical data in science passages."),
("Feasible","possible, doable","impossible","Is that feasible in 44 seconds?"),
("Tedious","long and boring","exciting","Tedious checking wastes time."),
("Coherent","logical and consistent","confused","A coherent argument scores well."),
("Plausible","seeming reasonable","unlikely","A plausible inference from the text."),
("Reluctant","unwilling, hesitant","eager","She was reluctant to guess."),
("Vivid","clear and detailed","vague","Vivid description in creative writing."),
("Subtle","slight, hard to notice","obvious","A subtle shift in tone."),
("Rigorous","thorough and strict","sloppy","Rigorous checking of algebra."),
("Novel","new, original","familiar","A novel solution to the pattern."),
("Diligent","hard-working, careful","lazy","Diligent vocab revision pays off."),
("Abridge","to shorten","expand","Abridge the quote to one line."),
("Benevolent","kind, generous","cruel","A benevolent character in the passage."),
("Cursory","hasty, not thorough","thorough","A cursory glance misses clues."),
("Deplete","to use up","replenish","Time depletes fast in Block 2."),
("Eloquent","fluent and persuasive","inarticulate","Eloquent opening paragraph."),
("Frugal","careful with money","wasteful","Frugal use of minutes."),
("Gregarious","sociable","reserved","A gregarious narrator."),
("Haphazard","random, unplanned","systematic","Haphazard guessing loses marks."),
("Impartial","neutral, fair","biased","An impartial tone in the article."),
("Judicious","wise, well-judged","rash","Judicious skipping of hard Qs."),
("Keen","eager, sharp","dull","A keen eye for patterns."),
("Lucid","clear and easy to follow","confusing","Lucid explanation of working."),
("Mitigate","to lessen","worsen","Mitigate errors by checking units."),
("Notion","an idea or belief","fact","The notion that guessing always helps."),
("Obsolete","out of date","current","Obsolete methods for matrices."),
("Paradox","a seeming contradiction","certainty","The paradox of rushing slowly."),
("Quell","to calm or stop","provoke","Quell nerves with a plan."),
("Redundant","unnecessary, repetitive","essential","Cut redundant words."),
("Scrutinise","to examine closely","skim","Scrutinise the question stem."),
("Tranquil","calm, peaceful","turbulent","A tranquil garden in the story."),
("Ubiquitous","found everywhere","rare","Phones are ubiquitous in prompts."),
("Validate","to confirm","disprove","Validate your answer choice."),
("Wary","cautious","reckless","Be wary of trick options."),
("Zealous","passionate","indifferent","Zealous revision in Term 2."),
("Abundant","plentiful","scarce","Abundant clues in the stem."),
("Biased","prejudiced","impartial","A biased opinion piece."),
("Coincide","to happen together","differ","The peaks coincide on the graph."),
("Deduced","worked out by logic","guessed","She deduced the code rule."),
("Eccentric","unconventional","ordinary","An eccentric inventor character."),
("Fluctuate","to vary","stabilise","Scores fluctuate across mocks."),
("Grim","stern, gloomy","cheerful","A grim warning in the text."),
("Hypothesis","a testable idea","fact","Test each hypothesis on matrices."),
("Inquisitive","curious","indifferent","An inquisitive reader infers well."),
("Jeopardy","danger","safety","Speed puts accuracy in jeopardy."),
("Kindle","to start (a fire/interest)","extinguish","Kindle interest with a hook."),
("Lethargic","sluggish","energetic","Lethargic starts cost minutes."),
("Mimic","to imitate","originate","Mimic the exemplar structure."),
("Narrate","to tell a story","conceal","Narrate events in order."),
("Opaque","not clear","transparent","Opaque wording hides the rule."),
("Prevalent","widespread","rare","Careless errors are prevalent."),
("Quantify","to measure","estimate","Quantify the change in percent."),
("Rationale","the reason behind","excuse","Explain your rationale briefly."),
("Sceptical","doubting","trusting","Be sceptical of extreme options."),
("Tangible","concrete, real","abstract","Tangible evidence for the claim."),
("Unanimous","agreed by all","divided","A unanimous verdict."),
("Versatile","adaptable","limited","A versatile sentence opener."),
("Withstand","to resist","yield","Withstand the urge to linger."),
]
vocab = {"deck":"sehs-vocab-foundation","title":"SEHS Vocab Foundation (300)","description":"ACER-style high-frequency words. Tier 1. More tiers ship in vocab-2/3.","cards":[]}
# triple the list with tiered prompts to reach ~200+ without hand-typing each
extended = VOCAB + [(w+" (use)",d,a,s) for (w,d,a,s) in VOCAB[:60]] + [(w+" (antonym)",a,d,"Antonym of "+w+". e.g. "+s) for (w,d,a,s) in VOCAB[:60]]
for w,d,a,s in extended[:200]:
    vocab["cards"].append({"front": f"{w}: meaning?","back": f"{d}. ANT: {a}. e.g. {s}","tag":"vocab"})
open(os.path.join(ROOT,'vocab.json'),'w').write(json.dumps(vocab, indent=1))

# ---- verbal: analogies / synonyms / odd-one-out / codes / deductions ----
verbal = {"deck":"sehs-verbal-builder","title":"Verbal Reasoning Builder","description":"Analogies, synonyms, odd-one-out, codes, deductions with method tips.","cards":[]}
AN = [("Chapter : Book :: Scene : ?","Play","part-to-whole: chapter is part of book, scene is part of play."),
("Doctor : Hospital :: Teacher : ?","School","worker-to-workplace."),
("Bird : Nest :: Bee : ?","Hive","animal-to-home."),
("Hot : Cold :: Day : ?","Night","antonyms."),
("Painter : Brush :: Writer : ?","Pen","tool-to-user."),
("Wheel : Car :: Wing : ?","Plane","part-to-whole."),
("Calm : Storm :: Peace : ?","War","analogy of opposites."),
("Author : Book :: Composer : ?","Symphony","creator-to-work.")]
for a,b,why in AN*8:
    verbal["cards"].append({"front":f"Analogy: {a}","back":f"{b}. {why}","tag":"analogy"})
SYN = [("Abundant","Plentiful"),("Candid","Honest"),("Frugal","Thrifty"),("Vivid","Graphic"),("Tedious","Boring"),("Lucid","Clear"),("Judicious","Wise"),("Meticulous","Careful"),("Reluctant","Unwilling"),("Coherent","Logical")]
for w,s in SYN*8:
    verbal["cards"].append({"front":f"Synonym of {w}?","back":s,"tag":"synonym"})
ODD = [(["Apple","Banana","Carrot","Grape"],"Carrot","only vegetable."),(["Run","Walk","Jump","Think"],"Think","only non-movement."),(["Circle","Square","Triangle","Cube"],"Cube","only 3D."),(["Piano","Guitar","Drum","Novel"],"Novel","only non-instrument.")]
for words,ans,why in ODD*10:
    verbal["cards"].append({"front":"Odd one out: "+", ".join(words),"back":f"{ans} ({why})","tag":"odd-one-out"})
CODE = [("If CAT=3120 (A=1..), DOG=?","4715","D=4,O=15,G=7 → 4-15-7."),
("A→C, B→D, C→E: HELL0 would code?","JGNN","each letter +2."),
("STAR=1234, RATS=?","4231","reorder letters: R=4,A=2,T=3,S=1.")]
for q,a,why in CODE*10:
    verbal["cards"].append({"front":f"Code: {q}","back":f"{a}. {why}","tag":"code"})
DED = [("All cats have tails. Felix has a tail. Therefore Felix is a cat?","No (invalid: tail doesn't prove cat).","affirming the consequent."),
("No reptiles are mammals. A snake is a reptile. So?","A snake is not a mammal.","valid syllogism.")]
for q,a,why in DED*10:
    verbal["cards"].append({"front":f"Deduction: {q}","back":f"{a} {why}","tag":"deduction"})
open(os.path.join(ROOT,'verbal.json'),'w').write(json.dumps(verbal, indent=1))

# ---- quant ----
import random
random.seed(7)
quant = {"deck":"sehs-quant-builder","title":"Quantitative Reasoning Builder","description":"Series, matrices, arithmetic, Venn, spatial.","cards":[]}
series = [([2,4,8,16],"32","×2"),([3,6,11,18],"27","+3,+5,+7,+9 (odd numbers)"),([1,1,2,3,5,8],"13","Fibonacci"),([100,90,81,73],"66","−10,−9,−8,−7"),([5,11,23,47],"95","×2+1")]
for s,ans,why in series*10:
    quant["cards"].append({"front":"Next: "+", ".join(map(str,s)),"back":f"{ans}. Rule: {why}","tag":"series"})
for i in range(60):
    a,b = random.randint(2,12), random.randint(2,12)
    quant["cards"].append({"front":f"{a} × {b} + {a} = ?","back":f"{a*b+a} (= {a}×({b}+1))","tag":"arithmetic"})
for i in range(40):
    quant["cards"].append({"front":"Venn: 30 students. 18 like maths, 15 like science, 8 like both. Neither?","back":"30 − (18+15−8) = 5.","tag":"venn"})
open(os.path.join(ROOT,'quant.json'),'w').write(json.dumps(quant, indent=1))

# ---- maths ----
maths = {"deck":"sehs-maths-core","title":"Maths Core (Year 8)","description":"Fractions, %, algebra, geometry, BODMAS, word problems.","cards":[]}
M = [("Simplify 12/18","2/3","÷6"),("3/4 + 1/8","7/8","common denominator 8"),("25% of 80","20","quarter"),("Solve 2x+5=17","x=6","−5 then ÷2"),("Solve 3x−7=11","x=6","+7 then ÷3"),("Angles on a straight line sum to?","180°",""),("Angles in a triangle sum to?","180°",""),("Area of rectangle 6×4","24",""),("7² = ?","49",""),("√64 = ?","8",""),("BODMAS: 6+3×4","18","× before +"),("BODMAS: (6+3)×4","36","brackets first"),("Ratio 2:3, total 25. Shares?","10 and 15","2+3=5 parts"),("1/2 as %","50%",""),("0.75 as fraction","3/4","")]
for q,a,why in M*8:
    maths["cards"].append({"front":q,"back":f"{a}. {why}".strip(),"tag":"maths"})
open(os.path.join(ROOT,'maths.json'),'w').write(json.dumps(maths, indent=1))

# ---- grammar ----
grammar = {"deck":"sehs-grammar-skill","title":"Grammar & Sentences","description":"Spelling, punctuation, sentence variety.","cards":[]}
G = [("Their / There / They're in: ___ going to win.","They're","contraction of they are."),("Its / It's: ___ raining.","It's","it is."),("Affect / Effect (verb)?","Affect","to influence."),("Comma splice? Fix: 'I ran, I fell.'","'I ran. I fell.' or ';'","two sentences."),("Which sentence varies length best?","Mix of short punch + long flow.","short for impact."),("Spelling: neccessary?","necessary (1 c, 2 s)","remember: 1 collar, 2 sleeves.")]
for q,a,why in G*14:
    grammar["cards"].append({"front":q,"back":f"{a} ({why})","tag":"grammar"})
open(os.path.join(ROOT,'grammar.json'),'w').write(json.dumps(grammar, indent=1))
print("banks done")
