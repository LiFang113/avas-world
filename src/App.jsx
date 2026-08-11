import { useState, useEffect, useRef, useCallback } from "react";
import {
  backendMode,
  createUserId,
  loadChatMessages,
  loadFriends,
  mergeFriendsByName,
  normalizeAccountName,
  resolveRecipientIds,
  saveAccount,
  saveFriends,
  searchAccounts,
  sendChatMessage,
  updatePresence,
} from "./backend.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// localStorage shim for window.storage (PWA version)
const storageApi = typeof window !== "undefined" ? window.storage : null;
if (typeof window !== "undefined" && !storageApi) {
  window.storage = {
    async get(key) {
      const val = window.localStorage?.getItem(key);
      return val ? { key, value: val } : null;
    },
    async set(key, value) {
      window.localStorage?.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      window.localStorage?.removeItem(key);
      return { key, deleted: true };
    },
    async list(prefix) {
      const keys = [];
      const localStorage = window.localStorage;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!prefix || k.startsWith(prefix)) keys.push(k);
      }
      return { keys };
    }
  };
}

const TABS = ["🏠","📚","📓","💬","🎵","🏆","📦"];
const TAB_LABELS = ["Home","Study","Diary","Chat","Music","Reward","More"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STUDY_SCHEDULE = {
  Mon:[{time:"9:00 AM",subject:"Math Practice",icon:"🔢",color:"#FF6B6B",duration:"45 min",stars:5},{time:"10:00 AM",subject:"Language Arts",icon:"📖",color:"#4ECDC4",duration:"40 min",stars:5},{time:"2:00 PM",subject:"Chinese Practice",icon:"🀄",color:"#FFE66D",duration:"30 min",stars:4}],
  Tue:[{time:"9:00 AM",subject:"Critical Thinking",icon:"🧩",color:"#A78BFA",duration:"50 min",stars:6},{time:"10:30 AM",subject:"Math Practice",icon:"🔢",color:"#FF6B6B",duration:"45 min",stars:5},{time:"2:00 PM",subject:"Language Arts",icon:"📖",color:"#4ECDC4",duration:"40 min",stars:5}],
  Wed:[{time:"9:00 AM",subject:"Chinese Practice",icon:"🀄",color:"#FFE66D",duration:"30 min",stars:4},{time:"10:00 AM",subject:"Math Practice",icon:"🔢",color:"#FF6B6B",duration:"45 min",stars:5},{time:"2:00 PM",subject:"Critical Thinking",icon:"🧩",color:"#A78BFA",duration:"50 min",stars:6}],
  Thu:[{time:"9:00 AM",subject:"Language Arts",icon:"📖",color:"#4ECDC4",duration:"40 min",stars:5},{time:"10:00 AM",subject:"Math Practice",icon:"🔢",color:"#FF6B6B",duration:"45 min",stars:5},{time:"2:00 PM",subject:"Chinese Practice",icon:"🀄",color:"#FFE66D",duration:"30 min",stars:4}],
  Fri:[{time:"9:00 AM",subject:"Math Practice",icon:"🔢",color:"#FF6B6B",duration:"45 min",stars:5},{time:"10:00 AM",subject:"Critical Thinking",icon:"🧩",color:"#A78BFA",duration:"50 min",stars:6},{time:"2:00 PM",subject:"Language Arts",icon:"📖",color:"#4ECDC4",duration:"40 min",stars:5}],
  Sat:[{time:"10:00 AM",subject:"Chinese Practice",icon:"🀄",color:"#FFE66D",duration:"30 min",stars:4},{time:"11:00 AM",subject:"Critical Thinking",icon:"🧩",color:"#A78BFA",duration:"50 min",stars:6}],
  Sun:[{time:"10:00 AM",subject:"Free Reading",icon:"📚",color:"#F472B6",duration:"30 min",stars:3}],
};

const MOTIVATIONAL_MSGS = ["You're a superstar, Ava! Let's collect some stars! 🌟","Every task brings you closer to rewards! 🎁","Your brain gets stronger every day! 💪","Ready to be a champion? 🏆","Small steps, big progress! 🚀","Let's get started! ✨"];

const CHINESE_CHARS = [
  {char:"一",pinyin:"yī",meaning:"One",sentence:"一二三 — One two three",funFact:"The simplest character — just one line!",strokeCount:1,strokeNames:["Horizontal"]},
  {char:"二",pinyin:"èr",meaning:"Two",sentence:"二月 — February",funFact:"Two lines = two! So logical!",strokeCount:2,strokeNames:["Short horizontal","Long horizontal"]},
  {char:"三",pinyin:"sān",meaning:"Three",sentence:"三个人 — Three people",funFact:"Three lines = three! See the pattern?",strokeCount:3,strokeNames:["Short horizontal","Medium horizontal","Long horizontal"]},
  {char:"人",pinyin:"rén",meaning:"Person",sentence:"好人 — Good person",funFact:"Looks like someone walking! 🚶",strokeCount:2,strokeNames:["Left-falling","Right-falling"]},
  {char:"大",pinyin:"dà",meaning:"Big",sentence:"大象很大 — Elephants are big",funFact:"A person stretching arms wide!",strokeCount:3,strokeNames:["Horizontal","Left-falling","Right-falling"]},
  {char:"口",pinyin:"kǒu",meaning:"Mouth",sentence:"口渴 — Thirsty",funFact:"An open mouth shape! 👄",strokeCount:3,strokeNames:["Vertical","Horizontal-turn","Horizontal"]},
  {char:"日",pinyin:"rì",meaning:"Sun / Day",sentence:"今日天气好 — Nice weather today",funFact:"Was once a picture of the sun ☀️!",strokeCount:4,strokeNames:["Vertical","Horizontal-turn-vertical","Inner horizontal","Bottom horizontal"]},
  {char:"月",pinyin:"yuè",meaning:"Moon / Month",sentence:"月亮很圆 — The moon is round",funFact:"Was a crescent moon 🌙!",strokeCount:4,strokeNames:["Left-falling-curve","Vertical-turn-hook","Inner horizontal 1","Inner horizontal 2"]},
  {char:"山",pinyin:"shān",meaning:"Mountain",sentence:"山很高 — The mountain is tall",funFact:"Three peaks pointing up! 🏔️",strokeCount:3,strokeNames:["Vertical","Vertical-turn-horizontal","Vertical"]},
  {char:"水",pinyin:"shuǐ",meaning:"Water",sentence:"我要喝水 — I want water",funFact:"Looks like a splashing stream! 💧",strokeCount:4,strokeNames:["Left hook","Vertical","Left-falling","Right-falling"]},
  {char:"火",pinyin:"huǒ",meaning:"Fire",sentence:"小心火 — Be careful of fire",funFact:"Flames rising up! 🔥",strokeCount:4,strokeNames:["Left dot","Right dot","Left-falling","Right-falling"]},
  {char:"木",pinyin:"mù",meaning:"Tree / Wood",sentence:"大树 — Big tree",funFact:"A tree with branches and roots! 🌳",strokeCount:4,strokeNames:["Horizontal","Vertical","Left-falling","Right-dot"]},
  {char:"土",pinyin:"tǔ",meaning:"Earth / Soil",sentence:"土地 — Land",funFact:"Things grow from the ground up! 🌱",strokeCount:3,strokeNames:["Horizontal","Vertical","Long horizontal"]},
  {char:"天",pinyin:"tiān",meaning:"Sky / Day",sentence:"天空很蓝 — The sky is blue",funFact:"Above 大 (big) is the sky!",strokeCount:4,strokeNames:["Horizontal","Horizontal","Left-falling","Right-falling"]},
  {char:"女",pinyin:"nǚ",meaning:"Woman / Girl",sentence:"女孩 — Girl",funFact:"Shows a graceful figure! 💃",strokeCount:3,strokeNames:["Left-falling-curve","Left-falling","Horizontal"]},
  {char:"子",pinyin:"zǐ",meaning:"Child",sentence:"孩子 — Child",funFact:"A baby with arms out!",strokeCount:3,strokeNames:["Horizontal-hook","Vertical","Horizontal"]},
  {char:"爱",pinyin:"ài",meaning:"Love",sentence:"我爱你 — I love you",funFact:"Has a 'heart' (心) hidden inside! 💕",strokeCount:10,strokeNames:["Left-falling","Horizontal","Vertical","Horizontal","Left-short","Horizontal","Left-falling","Dot","Left-dot","Right-dot"]},
];

const GAME_THEMES = [
  {name:"🌸 Cherry Blossom",colors:["#FFC0CB","#FF69B4","#FFB7C5"],unlocked:true},
  {name:"🌊 Ocean Wave",colors:["#4ECDC4","#45B7D1","#96E6FF"],unlocked:true},
  {name:"🌈 Rainbow",colors:["#FF6B6B","#FFE66D","#4ECDC4"],cost:60,unlocked:false},
  {name:"🦄 Unicorn",colors:["#E8A0FF","#FF6EB4","#FFF08D"],cost:80,unlocked:false},
  {name:"🌌 Galaxy",colors:["#2D1B69","#7C3AED","#C084FC"],cost:100,unlocked:false},
];
const CARD_SETS = {"🌸 Cherry Blossom":["🌸","🎀","🩰","💕","🌷","🎪","🧁","🍡"],"🌊 Ocean Wave":["🐬","🐙","🦈","🐚","🌊","⚓","🐠","🦑"],"🌈 Rainbow":["🌈","⭐","🎨","🦋","🌻","🎵","💎","🎠"],"🦄 Unicorn":["🦄","✨","🌙","💜","🔮","🎆","👑","🌟"],"🌌 Galaxy":["🚀","🪐","👽","🌌","☄️","🛸","⭐","🌑"]};

const RIDDLES = [
  {q:"I have hands but can't clap. What am I?",a:"A clock! ⏰",hint:"Tick tock...",cat:"🏠 Things"},
  {q:"What has a head and a tail but no body?",a:"A coin! 🪙",hint:"You flip it",cat:"🏠 Things"},
  {q:"I'm full of holes but still hold water. What am I?",a:"A sponge! 🧽",hint:"Found in the kitchen",cat:"🏠 Things"},
  {q:"What can you catch but never throw?",a:"A cold! 🤧",hint:"Achoo!",cat:"🧠 Tricky"},
  {q:"What has legs but doesn't walk?",a:"A table! 🪑",hint:"You eat on me",cat:"🏠 Things"},
  {q:"I go up but never come down. What am I?",a:"Your age! 🎂",hint:"Happy birthday!",cat:"🧠 Tricky"},
  {q:"What gets wetter the more it dries?",a:"A towel! 🛁",hint:"After a bath",cat:"🧠 Tricky"},
  {q:"What has ears but cannot hear?",a:"A corn! 🌽",hint:"Grows in a field",cat:"🌿 Nature"},
  {q:"I have teeth but cannot eat. What am I?",a:"A comb! 💇",hint:"Used on your hair",cat:"🏠 Things"},
  {q:"What can travel around the world while staying in a corner?",a:"A stamp! 📮",hint:"Goes on a letter",cat:"🧠 Tricky"},
  {q:"What has a neck but no head?",a:"A bottle! 🍼",hint:"You drink from it",cat:"🏠 Things"},
  {q:"I'm tall when I'm young and short when I'm old. What am I?",a:"A candle! 🕯️",hint:"I give light",cat:"🏠 Things"},
  {q:"What has words but never speaks?",a:"A book! 📚",hint:"You read me",cat:"🏠 Things"},
  {q:"What runs but never walks?",a:"Water! 💧",hint:"Found in a river",cat:"🌿 Nature"},
  {q:"What building has the most stories?",a:"A library! 📖",hint:"Think about it two ways...",cat:"🧠 Tricky"},
  {q:"What has one eye but cannot see?",a:"A needle! 🧵",hint:"Used for sewing",cat:"🏠 Things"},
  {q:"I have wings but I'm not a bird. I fly but I'm not a plane. What am I?",a:"A butterfly! 🦋",hint:"I was a caterpillar",cat:"🌿 Nature"},
  {q:"What starts with T, ends with T, and has T in it?",a:"A teapot! 🫖",hint:"Tea time!",cat:"🧠 Tricky"},
  {q:"What has 4 legs in the morning, 2 at noon, and 3 at night?",a:"A human! 🧑 (crawl, walk, then use a cane)",hint:"Think about a whole life",cat:"🧠 Tricky"},
  {q:"What kind of room has no doors or windows?",a:"A mushroom! 🍄",hint:"It grows in the forest",cat:"🌿 Nature"},
];

const TONGUE_TWISTERS = [
  {text:"She sells seashells by the seashore.",speed:"🐢 Slow",level:1,emoji:"🐚"},
  {text:"Red lorry, yellow lorry.",speed:"🐢 Slow",level:1,emoji:"🚗"},
  {text:"Toy boat. Toy boat. Toy boat.",speed:"🐢 Slow",level:1,emoji:"⛵"},
  {text:"Eleven benevolent elephants.",speed:"🐢 Slow",level:1,emoji:"🐘"},
  {text:"Fuzzy Wuzzy was a bear. Fuzzy Wuzzy had no hair.",speed:"🐇 Medium",level:2,emoji:"🧸"},
  {text:"How much wood would a woodchuck chuck if a woodchuck could chuck wood?",speed:"🐇 Medium",level:2,emoji:"🪵"},
  {text:"I scream, you scream, we all scream for ice cream!",speed:"🐇 Medium",level:2,emoji:"🍦"},
  {text:"Peter Piper picked a peck of pickled peppers.",speed:"🐇 Medium",level:2,emoji:"🌶️"},
  {text:"Betty Botter bought some butter, but she said the butter's bitter.",speed:"🏎️ Fast",level:3,emoji:"🧈"},
  {text:"Six slippery snails slid slowly seaward.",speed:"🏎️ Fast",level:3,emoji:"🐌"},
  {text:"Which wristwatches are Swiss wristwatches?",speed:"🏎️ Fast",level:3,emoji:"⌚"},
  {text:"Unique New York. Unique New York. You know you need unique New York.",speed:"🏎️ Fast",level:3,emoji:"🗽"},
  {text:"If a dog chews shoes, whose shoes does he choose?",speed:"🐇 Medium",level:2,emoji:"👟"},
  {text:"A big black bear sat on a big black rug.",speed:"🐢 Slow",level:1,emoji:"🐻"},
  {text:"Whether the weather is cold, or whether the weather is hot.",speed:"🏎️ Fast",level:3,emoji:"🌦️"},
];

const JOKES = [
  {setup:"Why don't scientists trust atoms?",punchline:"Because they make up everything! 😂",cat:"🔬 Science"},
  {setup:"What do you call a sleeping dinosaur?",punchline:"A dino-snore! 🦕💤",cat:"🦖 Animals"},
  {setup:"Why did the math book look so sad?",punchline:"Because it had too many problems! 📚",cat:"📐 School"},
  {setup:"What do you call a fake noodle?",punchline:"An impasta! 🍝",cat:"🍕 Food"},
  {setup:"Why can't you give Elsa a balloon?",punchline:"Because she will let it go! 🎈❄️",cat:"🎬 Movies"},
  {setup:"What do you call a bear with no teeth?",punchline:"A gummy bear! 🐻🍬",cat:"🦖 Animals"},
  {setup:"Why did the student eat their homework?",punchline:"Because the teacher said it was a piece of cake! 🍰",cat:"📐 School"},
  {setup:"What do elves learn in school?",punchline:"The elf-abet! 🧝",cat:"📐 School"},
  {setup:"Why did the banana go to the doctor?",punchline:"Because it wasn't peeling well! 🍌",cat:"🍕 Food"},
  {setup:"What do you call a fish without eyes?",punchline:"A fsh! 🐟",cat:"🦖 Animals"},
  {setup:"Why couldn't the bicycle stand up by itself?",punchline:"Because it was two-tired! 🚲",cat:"🏠 Things"},
  {setup:"What do cows read in the morning?",punchline:"The moos-paper! 🐄📰",cat:"🦖 Animals"},
  {setup:"Why are ghosts bad liars?",punchline:"Because you can see right through them! 👻",cat:"🎃 Spooky"},
  {setup:"What did the ocean say to the beach?",punchline:"Nothing, it just waved! 🌊",cat:"🌿 Nature"},
  {setup:"What do you call a pig that does karate?",punchline:"A pork chop! 🐷🥋",cat:"🦖 Animals"},
  {setup:"Why did the teddy bear say no to dessert?",punchline:"Because she was already stuffed! 🧸",cat:"🍕 Food"},
  {setup:"What did one wall say to the other?",punchline:"I'll meet you at the corner! 🏠",cat:"🏠 Things"},
  {setup:"How do you organize a space party?",punchline:"You planet! 🪐🎉",cat:"🔬 Science"},
  {setup:"What do you call a dog that does magic?",punchline:"A Labracadabrador! 🐕✨",cat:"🦖 Animals"},
  {setup:"Why don't eggs tell jokes?",punchline:"They'd crack each other up! 🥚😂",cat:"🍕 Food"},
];
const DEFAULT_REWARDS = [{name:"Choose dinner tonight",stars:50,emoji:"🍕"},{name:"Movie night pick",stars:80,emoji:"🎬"},{name:"New book from bookstore",stars:100,emoji:"📚"},{name:"Fun outing with friends",stars:150,emoji:"🎡"},{name:"Ice cream date with Mom",stars:200,emoji:"🍦"},{name:"Special surprise gift",stars:300,emoji:"🎁"}];
const DEFAULT_SONGS = [{title:"Shake It Off",artist:"Taylor Swift",mood:"🎉 Upbeat",ytId:"nfWlot6h_JM"},{title:"Happy",artist:"Pharrell Williams",mood:"😊 Happy",ytId:"ZbZSe6N_BXs"},{title:"Let It Go",artist:"Frozen",mood:"❄️ Magical",ytId:"YVVTZgwYwVo"},{title:"Count on Me",artist:"Bruno Mars",mood:"💛 Friends",ytId:"KCB11BPRIEM"},{title:"A Million Dreams",artist:"Greatest Showman",mood:"✨ Dreamy",ytId:"pSQk-4fddDI"},{title:"Roar",artist:"Katy Perry",mood:"🦁 Brave",ytId:"CevxZvSJLk8"}];
const makeDateKey = d => d.toISOString().split("T")[0];
const td = new Date();
const INITIAL_LOVE_LOG = {};
for(let i=1;i<=14;i++){const d=new Date(td);d.setDate(d.getDate()-i);INITIAL_LOVE_LOG[makeDateKey(d)]={kisses:Math.floor(Math.random()*12)+3,loveyous:Math.floor(Math.random()*8)+2};}
const LOVE_QUOTES = ["Mom's love is the biggest magic! ✨","Every kiss is a star on your cheek! 🌟","Most loved girl in the universe! 💕","Mom's hugs fix anything! 🤗","Love grows bigger every day! 🌱","You make Mom smile just by being you! 😊","A kiss from Mom is the best gift! 🎁","Mom loves you to the moon and back! 🌙"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ART & CRAFT DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BIG_FESTIVALS = [
  { name:"Valentine's Day", month:2, startDay:7, endDay:14, emoji:"💝", theme:"valentine" },
  { name:"Chinese New Year", month:1, startDay:20, endDay:31, emoji:"🧧", theme:"cny" },
  { name:"Chinese New Year", month:2, startDay:1, endDay:10, emoji:"🧧", theme:"cny" },
  { name:"Easter", month:4, startDay:1, endDay:20, emoji:"🐣", theme:"easter" },
  { name:"Mother's Day", month:5, startDay:1, endDay:12, emoji:"👩‍👧", theme:"mothers" },
  { name:"Father's Day", month:6, startDay:10, endDay:20, emoji:"👨‍👧", theme:"fathers" },
  { name:"Halloween", month:10, startDay:15, endDay:31, emoji:"🎃", theme:"halloween" },
  { name:"Thanksgiving", month:11, startDay:18, endDay:28, emoji:"🦃", theme:"thanksgiving" },
  { name:"Christmas", month:12, startDay:1, endDay:25, emoji:"🎄", theme:"christmas" },
  { name:"New Year", month:12, startDay:26, endDay:31, emoji:"🎆", theme:"newyear" },
  { name:"New Year", month:1, startDay:1, endDay:5, emoji:"🎆", theme:"newyear" },
  { name:"Mid-Autumn", month:9, startDay:10, endDay:25, emoji:"🥮", theme:"midautumn" },
];

const STEM_CATEGORIES = ["🔬 All","🌋 Science","🏗️ Engineering","🎨 Art+Science","🌱 Nature","🧮 Math"];

const STEM_ACTIVITIES = [
  {id:1, title:"Baking Soda Volcano", cat:"🌋 Science", icon:"🌋", time:"15 min", difficulty:1, stars:8, ages:"5-10",
    question:"What happens when an acid meets a base?",
    materials:["Baking soda","Vinegar","Dish soap","Food coloring","Cup or bottle","Tray/plate"],
    steps:["Place a cup or small bottle on a tray to catch overflow.","Put 2 tablespoons of baking soda inside.","Add a squirt of dish soap and a few drops of food coloring.","Pour in about ¼ cup of vinegar and watch it ERUPT!","Try again with different amounts — what makes the biggest eruption?"],
    science:"Baking soda (a base) reacts with vinegar (an acid) to make carbon dioxide gas. The soap traps the gas in bubbles, making it foam up like lava!",
    tryThis:"Add glitter before the vinegar for sparkly lava! 🌟"},

  {id:2, title:"Walking Water Rainbow", cat:"🌋 Science", icon:"🌈", time:"30 min", difficulty:1, stars:10, ages:"5-10",
    question:"Can water walk from one cup to another?",
    materials:["7 cups or glasses","Water","Food coloring (red, yellow, blue)","Paper towels"],
    steps:["Line up 7 cups in a row. Fill cups 1, 3, 5, and 7 with water.","Add red food coloring to cups 1 and 7, yellow to cup 3, blue to cup 5.","Fold paper towels lengthwise into strips.","Place paper towel strips connecting each cup to its neighbor — like bridges!","Wait 1-2 hours and watch the colors walk and MIX in the empty cups!"],
    science:"This is called capillary action! Water molecules stick together and climb through the tiny gaps in the paper towel fibers, carrying color with them.",
    tryThis:"Predict what colors will appear in the empty cups before it happens! 🤔"},

  {id:3, title:"Egg Drop Challenge", cat:"🏗️ Engineering", icon:"🥚", time:"30 min", difficulty:2, stars:12, ages:"6-10",
    question:"Can you protect a raw egg from a 6-foot drop?",
    materials:["Raw egg","Bubble wrap, cotton balls, or newspaper","Tape","Plastic bag","Cardboard","Straws"],
    steps:["Wrap your egg in a plastic bag first (for easy cleanup!).","Design a protective shell using your materials — think about cushioning!","Popular designs: parachute, nest of cotton, straw cage, or padded box.","Test your design by dropping it from waist height first.","If it survives, try a higher drop! Can it survive from above your head?"],
    science:"Engineers think about force distribution — spreading the impact over a larger area and longer time protects the egg, just like car airbags work!",
    tryThis:"Challenge a friend! Whose egg survives the highest drop? 🏆"},

  {id:4, title:"Invisible Ink Secret Messages", cat:"🌋 Science", icon:"🔍", time:"15 min", difficulty:1, stars:6, ages:"5-10",
    question:"Can you write a message nobody can see?",
    materials:["Lemon juice","Cotton swab or thin paintbrush","White paper","Lamp or iron (with adult help)"],
    steps:["Squeeze lemon juice into a small bowl.","Dip a cotton swab into the lemon juice.","Write a secret message or draw a picture on white paper.","Let it dry completely — it becomes invisible!","Hold the paper near a warm lamp (ask a grown-up!) and watch the message appear!"],
    science:"Lemon juice is an organic substance that oxidizes (turns brown) when heated. The acid weakens the paper where you wrote, so it burns slightly and turns brown first!",
    tryThis:"Try milk or honey — do they work as invisible ink too? 🕵️"},

  {id:5, title:"Build a Straw Bridge", cat:"🏗️ Engineering", icon:"🌉", time:"25 min", difficulty:2, stars:10, ages:"6-10",
    question:"How many pennies can your straw bridge hold?",
    materials:["20 straws","Tape","2 books (same height)","Small cup","Pennies or coins"],
    steps:["Place two books about 8 inches apart — this is your canyon!","Use straws and tape to build a bridge between the books.","Think about shapes: triangles are the strongest shape in engineering!","Place a small cup on top of your bridge.","Add pennies one by one. How many before it collapses?"],
    science:"Triangles distribute force evenly through their sides, which is why they're used in real bridges, cranes, and buildings. Flat shapes bend easily, but triangles resist bending!",
    tryThis:"Try building a different design. Can you beat your first record? 📐"},

  {id:6, title:"DIY Lava Lamp", cat:"🎨 Art+Science", icon:"🪩", time:"10 min", difficulty:1, stars:7, ages:"5-10",
    question:"Can oil and water ever mix?",
    materials:["Clear bottle or jar","Vegetable oil","Water","Food coloring","Alka-Seltzer tablet (or salt)"],
    steps:["Fill the bottle ¾ full with vegetable oil.","Pour water in until it's almost full. Watch it sink below the oil!","Add 5-6 drops of food coloring. Watch the drops fall through the oil!","Break an Alka-Seltzer tablet into small pieces and drop one in.","Watch your lava lamp bubble! Add more pieces when it slows down."],
    science:"Oil and water don't mix because water molecules are polar (like tiny magnets) and oil molecules are not. The Alka-Seltzer creates CO₂ gas bubbles that carry colored water up through the oil!",
    tryThis:"Use a flashlight behind it in a dark room for an amazing glow effect! ✨"},

  {id:7, title:"Grow a Crystal Garden", cat:"🌱 Nature", icon:"💎", time:"3 days", difficulty:2, stars:15, ages:"6-10",
    question:"How do crystals form in nature?",
    materials:["Borax powder (laundry aisle)","Hot water","Jar","Pipe cleaner","Pencil","String","Food coloring"],
    steps:["Bend a pipe cleaner into a fun shape — star, heart, or spiral!","Tie it to a pencil with string so it hangs inside the jar without touching sides.","Ask an adult to dissolve 3 tablespoons of borax per cup of HOT water.","Add food coloring to the water, then pour into the jar.","Set the pencil across the top so the shape hangs in the solution. Wait 12-24 hours!"],
    science:"As the hot water cools, it can't hold as much dissolved borax. The extra borax molecules attach to the pipe cleaner and stack up in a repeating pattern — that's a crystal!",
    tryThis:"Try different shapes and colors. The longer you wait, the bigger the crystals! 💎"},

  {id:8, title:"Paper Airplane Lab", cat:"🏗️ Engineering", icon:"✈️", time:"20 min", difficulty:1, stars:8, ages:"5-10",
    question:"What plane design flies the farthest?",
    materials:["5 sheets of paper","Tape","Ruler or measuring tape","Paper clips"],
    steps:["Fold 3 different airplane designs (dart, glider, and wide-wing).","Throw each plane 3 times from the same spot and measure the distance.","Write down your results — which went farthest? Which flew longest?","Now experiment: add a paper clip to the nose. Does it help or hurt?","Try bending the back edges up slightly (called elevators). What changes?"],
    science:"Four forces act on a plane: thrust (your throw), lift (air pushing up on wings), drag (air resistance), and gravity. Different shapes balance these forces differently!",
    tryThis:"Have a competition! One contest for distance, one for hang time! ✈️"},

  {id:9, title:"Static Electricity Magic", cat:"🌋 Science", icon:"⚡", time:"10 min", difficulty:1, stars:6, ages:"5-10",
    question:"Can you bend water without touching it?",
    materials:["Balloon","Wool sweater or your hair","Water faucet","Small paper pieces","Salt and pepper"],
    steps:["Blow up a balloon and rub it on a wool sweater or your hair for 30 seconds.","Hold the balloon near small paper pieces — they jump up to it!","Turn on a thin stream of water and hold the balloon close — watch the water bend!","Sprinkle salt and pepper on a table. Hold the charged balloon above — the pepper jumps first!","Rub the balloon again and stick it to a wall — it stays!"],
    science:"Rubbing creates static electricity by transferring tiny particles called electrons. The balloon gets extra electrons (negative charge) that attract the positive charges in paper, water, and pepper!",
    tryThis:"Can you make your hair stand up with the balloon? 😂"},

  {id:10, title:"Seed Jar Observation", cat:"🌱 Nature", icon:"🌱", time:"7 days", difficulty:1, stars:12, ages:"5-10",
    question:"What do seeds need to sprout?",
    materials:["Clear jar or ziplock bag","Paper towel","Bean seeds (lima beans work great!)","Water","Tape"],
    steps:["Wet a paper towel so it's damp (not dripping).","Fold it and place it inside a clear jar or ziplock bag.","Tuck 2-3 bean seeds between the paper towel and the glass/plastic.","Tape the jar in a sunny window and keep the towel moist.","Draw what you see each day in a journal! Root appears first, then stem, then leaves!"],
    science:"Seeds contain a tiny plant embryo and stored food. Water activates enzymes that break down the stored food, giving the baby plant energy to grow roots and shoots!",
    tryThis:"Try a second jar in a dark closet — what's different? This tests if seeds need light! 🔬"},

  {id:11, title:"Symmetry Art", cat:"🧮 Math", icon:"🦋", time:"15 min", difficulty:1, stars:7, ages:"5-10",
    question:"What is symmetry and where is it in nature?",
    materials:["Paper","Washable paint","Paintbrush","Scissors"],
    steps:["Fold a piece of paper exactly in half, then open it.","Paint a colorful design on ONE side of the fold only.","Quickly fold the paper and press firmly all over.","Open it up — you made symmetry! Both sides match perfectly!","Look around: find 5 things that are symmetrical (butterfly, face, leaf, snowflake)."],
    science:"Symmetry means both sides are mirror images. Math helps us understand patterns in nature — butterflies, flowers, and even your face use symmetry!",
    tryThis:"Try cutting out your symmetrical painting along the outside edge for a cool shape! ✂️"},

  {id:12, title:"Bouncy Ball Factory", cat:"🌋 Science", icon:"🏀", time:"15 min", difficulty:2, stars:9, ages:"6-10",
    question:"Can you make a ball that bounces from just two ingredients?",
    materials:["White glue (like Elmer's)","Borax powder","Warm water","Cups","Spoon","Food coloring"],
    steps:["In cup 1: dissolve 1 teaspoon of borax in ½ cup of warm water. Stir well.","In cup 2: pour 1 tablespoon of glue, then add food coloring and stir.","Pour 1 teaspoon of the borax water into the glue cup.","Stir for 10 seconds, then use your hands to squish and roll it into a ball.","Let it set for 30 seconds, then bounce it! How high does it go?"],
    science:"This is a polymer reaction! Glue contains long chain molecules. Borax links these chains together into a flexible, bouncy solid — it's not quite liquid and not quite solid!",
    tryThis:"Try different ratios of glue and borax — what makes the bounciest ball? 🧪"},
];

const POPULAR_KIDS_SONGS = [
  {title:"Baby Shark",artist:"Pinkfong",ytId:"XqZsoesa55w",tags:"baby shark dance kids"},
  {title:"Let It Go",artist:"Frozen",ytId:"YVVTZgwYwVo",tags:"frozen disney elsa"},
  {title:"Shake It Off",artist:"Taylor Swift",ytId:"nfWlot6h_JM",tags:"taylor swift dance pop"},
  {title:"Happy",artist:"Pharrell Williams",ytId:"ZbZSe6N_BXs",tags:"happy pharrell dance"},
  {title:"Roar",artist:"Katy Perry",ytId:"CevxZvSJLk8",tags:"katy perry empowerment"},
  {title:"Count on Me",artist:"Bruno Mars",ytId:"KCB11BPRIEM",tags:"bruno mars friends"},
  {title:"A Million Dreams",artist:"Greatest Showman",ytId:"pSQk-4fddDI",tags:"greatest showman dream"},
  {title:"Can't Stop the Feeling",artist:"Justin Timberlake",ytId:"ru0K8uYEZWw",tags:"trolls dance feeling"},
  {title:"Dynamite",artist:"BTS",ytId:"gdZLi9oWNZg",tags:"bts kpop dance"},
  {title:"Old Town Road",artist:"Lil Nas X",ytId:"w2Ov5jzm3j8",tags:"country western horse"},
  {title:"Sunflower",artist:"Post Malone",ytId:"ApXoWvfEYVU",tags:"spiderman sunflower"},
  {title:"Señorita",artist:"Shawn Mendes & Camila",ytId:"Pkh8UtuejGw",tags:"senorita latin"},
  {title:"Havana",artist:"Camila Cabello",ytId:"BQ0mxQXmLsk",tags:"havana latin dance"},
  {title:"Fight Song",artist:"Rachel Platten",ytId:"xo1VInw-SKc",tags:"fight brave empowerment"},
  {title:"Brave",artist:"Sara Bareilles",ytId:"QUQsqBqxoR4",tags:"brave empowerment"},
  {title:"Try Everything",artist:"Shakira",ytId:"c6rP-YP4c5I",tags:"zootopia try shakira"},
  {title:"How Far I'll Go",artist:"Moana",ytId:"cPAbx5kgCJo",tags:"moana disney ocean"},
  {title:"Under the Sea",artist:"Little Mermaid",ytId:"GC_mV1IpjWA",tags:"little mermaid disney"},
  {title:"A Whole New World",artist:"Aladdin",ytId:"hZ1Rb9hC4JY",tags:"aladdin disney magic"},
  {title:"Hakuna Matata",artist:"Lion King",ytId:"nbY_aP-alkw",tags:"lion king disney"},
  {title:"You're Welcome",artist:"Moana (Maui)",ytId:"79DijItQXMM",tags:"moana maui disney"},
  {title:"Into the Unknown",artist:"Frozen 2",ytId:"gIOyB9ZXn8s",tags:"frozen elsa disney"},
  {title:"Memories",artist:"Maroon 5",ytId:"SlPhMPnQ58k",tags:"maroon memories"},
  {title:"Uptown Funk",artist:"Bruno Mars",ytId:"OPf0YbXqDm0",tags:"bruno mars funk dance"},
  {title:"Sugar",artist:"Maroon 5",ytId:"09R8_2nJtjg",tags:"maroon sugar sweet"},
  {title:"Believer",artist:"Imagine Dragons",ytId:"7wtfhZwyrcc",tags:"imagine dragons rock"},
  {title:"Thunder",artist:"Imagine Dragons",ytId:"fKopy74weus",tags:"imagine dragons"},
  {title:"Peaches",artist:"Justin Bieber",ytId:"tQ0yjYUFKAE",tags:"justin bieber peaches"},
  {title:"Levitating",artist:"Dua Lipa",ytId:"TUVcZfQe-Kw",tags:"dua lipa dance"},
  {title:"Dance Monkey",artist:"Tones and I",ytId:"q0hyYWKXF0Q",tags:"dance monkey"},
  {title:"Wheels on the Bus",artist:"CoComelon",ytId:"e_04ZrNroTo",tags:"nursery rhyme cocomelon bus"},
  {title:"Twinkle Twinkle",artist:"Super Simple Songs",ytId:"yCjJyiqpAuU",tags:"nursery rhyme star lullaby"},
  {title:"Baby One More Time",artist:"Britney Spears",ytId:"C-u5WLJ9Yk4",tags:"britney pop classic"},
  {title:"Photograph",artist:"Ed Sheeran",ytId:"nSDgHBxUbVQ",tags:"ed sheeran photo"},
  {title:"Perfect",artist:"Ed Sheeran",ytId:"2Vv-BfVoq4g",tags:"ed sheeran love"},
];


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMALL COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function FloatingStars({count,onDone}){const cb=useRef(onDone);cb.current=onDone;const[s]=useState(()=>Array.from({length:count},(_,i)=>({id:i,x:25+Math.random()*50,delay:i*.08})));useEffect(()=>{const t=setTimeout(()=>cb.current?.(),1400);return()=>clearTimeout(t)},[]);return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}>{s.map(x=><div key={x.id} style={{position:"absolute",left:`${x.x}%`,bottom:"40%",fontSize:26,animation:`floatUp 1.2s ease-out ${x.delay}s forwards`,opacity:0}}>⭐</div>)}<style>{`@keyframes floatUp{0%{transform:translateY(0) scale(.5);opacity:0}30%{opacity:1;transform:translateY(-40px) scale(1.2)}100%{transform:translateY(-180px) scale(.3);opacity:0}}`}</style></div>)}
function FloatingEmojis({emoji,count,onDone}){const cb=useRef(onDone);cb.current=onDone;const[s]=useState(()=>Array.from({length:Math.min(count,8)},(_,i)=>({id:i,x:20+Math.random()*60,delay:i*.06})));useEffect(()=>{const t=setTimeout(()=>cb.current?.(),1600);return()=>clearTimeout(t)},[]);return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}>{s.map(x=><div key={x.id} style={{position:"absolute",left:`${x.x}%`,bottom:"35%",fontSize:32,animation:`loveFloat 1.4s ease-out ${x.delay}s forwards`,opacity:0}}>{emoji}</div>)}<style>{`@keyframes loveFloat{0%{transform:translateY(0) scale(.4);opacity:0}20%{opacity:1;transform:translateY(-30px) scale(1.3)}100%{transform:translateY(-200px) scale(.2);opacity:0}}`}</style></div>)}
function StrokeAnimation({char,strokes}){return null}
function CharacterPractice({char,strokeCount,strokeNames}){
  const canvasRef=useRef(null);const[mode,setMode]=useState("learn");const[drawing,setDrawing]=useState(false);const[paths,setPaths]=useState([]);const[currentPath,setCurrentPath]=useState([]);const[strokeIdx,setStrokeIdx]=useState(0);const[showGhost,setShowGhost]=useState(true);const[score,setScore]=useState(null);
  const colors=["#EF4444","#F59E0B","#22C55E","#3B82F6","#8B5CF6","#EC4899","#14B8A6","#F97316","#6366F1","#D946EF"];
  const clearCanvas=()=>{setPaths([]);setCurrentPath([]);setStrokeIdx(0);setScore(null)};
  const getPos=(e)=>{const el=canvasRef.current;if(!el)return{x:0,y:0};const r=el.getBoundingClientRect();const touch=e.touches?e.touches[0]:e;return{x:((touch.clientX-r.left)/r.width)*260,y:((touch.clientY-r.top)/r.height)*260}};
  const canDraw=mode==="trace"||mode==="test";
  const startDraw=(e)=>{e.preventDefault();if(!canDraw||score!==null)return;setDrawing(true);const p=getPos(e);setCurrentPath([p])};
  const moveDraw=(e)=>{e.preventDefault();if(!drawing)return;const p=getPos(e);setCurrentPath(prev=>[...prev,p])};
  const endDraw=(e)=>{e.preventDefault();if(!drawing)return;setDrawing(false);if(currentPath.length>3){const newPaths=[...paths,{points:[...currentPath],color:colors[strokeIdx%10]}];setPaths(newPaths);const newIdx=strokeIdx+1;if(newIdx>=strokeCount){setStrokeIdx(newIdx);setScore(100)}else{setStrokeIdx(newIdx)}}setCurrentPath([])};
  const pathToD=(points)=>{if(points.length<2)return"";let d=`M ${points[0].x} ${points[0].y}`;for(let i=1;i<points.length;i++){d+=` L ${points[i].x} ${points[i].y}`}return d};
  return(<div>
    <div style={{display:"flex",gap:3,marginBottom:10}}>
      {[{k:"learn",l:"📖 Learn",c:"#FBBF24"},{k:"trace",l:"✏️ Trace",c:"#8B5CF6"},{k:"test",l:"📝 Test",c:"#22C55E"}].map(m=>
        <button key={m.k} onClick={()=>{setMode(m.k);clearCanvas()}} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",background:mode===m.k?m.c:m.c+"20",color:mode===m.k?"#FFF":m.c}}>{m.l}</button>
      )}
    </div>
    <div style={{position:"relative",width:260,maxWidth:"100%",height:260,margin:"0 auto 10px",borderRadius:16,background:"#FFFDF7",border:"3px solid #F3E8D0",overflow:"hidden",touchAction:"none",boxSizing:"border-box"}}>
      {/* Grid lines */}
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 260 260">
        <line x1="130" y1="0" x2="130" y2="260" stroke="#F0E6D3" strokeWidth="1" strokeDasharray="6,6"/>
        <line x1="0" y1="130" x2="260" y2="130" stroke="#F0E6D3" strokeWidth="1" strokeDasharray="6,6"/>
        <line x1="0" y1="0" x2="260" y2="260" stroke="#F0E6D3" strokeWidth="0.5" strokeDasharray="4,8"/>
        <line x1="260" y1="0" x2="0" y2="260" stroke="#F0E6D3" strokeWidth="0.5" strokeDasharray="4,8"/>
      </svg>
      {/* Ghost character for learn & trace modes */}
      {(mode==="learn"||(mode==="trace"&&showGhost))&&(
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:200,color:mode==="learn"?"#1F2937":paths.length>0?"#F3F4F6":"#E5E7EB",fontFamily:"'Noto Sans SC',serif",userSelect:"none",lineHeight:1,pointerEvents:"none",transition:"color .3s"}}>{char}</div>
      )}
      {/* Stroke count badge */}
      {mode==="learn"&&(
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)"}}>
          <div style={{background:"rgba(0,0,0,.6)",padding:"4px 12px",borderRadius:8}}>
            <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,color:"#FFF"}}>{strokeCount} strokes</span>
          </div>
        </div>
      )}
      {/* Drawing SVG canvas */}
      {canDraw&&(
        <svg ref={canvasRef} viewBox="0 0 260 260" style={{position:"absolute",inset:0,width:"100%",height:"100%",cursor:"crosshair",zIndex:2}}
          onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={()=>{if(drawing){setDrawing(false);setCurrentPath([])}}}
          onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}>
          {paths.map((p,i)=><path key={i} d={pathToD(p.points)} fill="none" stroke={p.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>)}
          {currentPath.length>1&&<path d={pathToD(currentPath)} fill="none" stroke={colors[strokeIdx%10]} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>}
        </svg>
      )}
      {/* Completion overlay */}
      {score!==null&&(
        <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,.88)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",zIndex:3,animation:"popBounce .4s ease"}}>
          <div style={{fontSize:40}}>🎉</div>
          <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:22,fontWeight:700,color:"#059669",marginTop:4}}>Great job!</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#6B7280",marginTop:2}}>All {strokeCount} strokes done!</div>
          <button onClick={clearCanvas} style={{marginTop:10,...BS,background:"linear-gradient(135deg,#A78BFA,#7C3AED)",color:"#FFF",fontSize:12}}>✏️ Try Again</button>
          <style>{`@keyframes popBounce{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}
    </div>
    {/* Controls for trace/test */}
    {canDraw&&score===null&&(
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:8}}>
        <button onClick={clearCanvas} style={{...BS,background:"#F3F4F6",color:"#6B7280",fontSize:11}}>↺ Clear</button>
        {mode==="trace"&&<button onClick={()=>setShowGhost(g=>!g)} style={{...BS,background:showGhost?"#EDE9FE":"#F3F4F6",color:showGhost?"#7C3AED":"#6B7280",fontSize:11}}>{showGhost?"👁 Guide On":"👁 Guide Off"}</button>}
        <div style={{padding:"5px 10px",borderRadius:8,background:colors[strokeIdx%10]+"20"}}>
          <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:600,color:colors[strokeIdx%10]}}>Stroke {Math.min(strokeIdx+1,strokeCount)}/{strokeCount}</span>
        </div>
      </div>
    )}
    {/* Stroke order guide for learn mode */}
    {mode==="learn"&&strokeNames&&(
      <div style={{background:"#FFF",borderRadius:10,padding:8,marginBottom:6}}>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:600,color:"#1F2937",marginBottom:4}}>✏️ Stroke Order:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {strokeNames.map((name,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,background:colors[i%10]+"15"}}>
              <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:10,fontWeight:700,color:colors[i%10]}}>{i+1}</span>
              <span style={{fontFamily:"'Nunito',sans-serif",fontSize:9,color:"#4B5563"}}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Instructions for trace/test mode */}
    {canDraw&&score===null&&(
      <div style={{padding:"6px 10px",background:mode==="trace"?"#F5F3FF":"#F0FDF4",borderRadius:8,textAlign:"center"}}>
        <span style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:mode==="trace"?"#7C3AED":"#059669"}}>
          {mode==="trace"?"✏️ Draw each stroke over the guide character":"📝 Write the character from memory!"}
          {" — Stroke "}{Math.min(strokeIdx+1,strokeCount)}{" of "}{strokeCount}
        </span>
      </div>
    )}
  </div>);
}
const BS={padding:"7px 14px",borderRadius:9,border:"none",fontFamily:"'Fredoka',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"};

const DRAWING_COLORS = ["#111827","#EF4444","#F97316","#FBBF24","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899","#FFFFFF"];
const DRAWING_TEMPLATES = [
  {id:"flower",name:"Garden Flower",tags:["flower","garden","spring","plant","nature"],regions:[["stem","path",{d:"M160 210 C160 176 160 150 160 124"}],["leaf1","ellipse",{cx:137,cy:165,rx:24,ry:12,transform:"rotate(-28 137 165)"}],["leaf2","ellipse",{cx:184,cy:154,rx:24,ry:12,transform:"rotate(28 184 154)"}],["petal1","ellipse",{cx:160,cy:78,rx:24,ry:39}],["petal2","ellipse",{cx:120,cy:110,rx:24,ry:39,transform:"rotate(-62 120 110)"}],["petal3","ellipse",{cx:200,cy:110,rx:24,ry:39,transform:"rotate(62 200 110)"}],["petal4","ellipse",{cx:135,cy:130,rx:24,ry:39,transform:"rotate(135 135 130)"}],["petal5","ellipse",{cx:185,cy:130,rx:24,ry:39,transform:"rotate(-135 185 130)"}],["center","circle",{cx:160,cy:112,r:22}]]},
  {id:"rainbow",name:"Happy Rainbow",tags:["rainbow","color","sky","happy","weather"],regions:[["arc1","path",{d:"M54 184 A106 106 0 0 1 266 184"}],["arc2","path",{d:"M82 184 A78 78 0 0 1 238 184"}],["arc3","path",{d:"M110 184 A50 50 0 0 1 210 184"}],["cloud1","circle",{cx:63,cy:187,r:18}],["cloud2","circle",{cx:89,cy:184,r:24}],["cloud3","circle",{cx:113,cy:190,r:17}],["cloud4","circle",{cx:222,cy:187,r:18}],["cloud5","circle",{cx:248,cy:184,r:24}],["cloud6","circle",{cx:272,cy:190,r:17}]]},
  {id:"unicorn-face",name:"Unicorn Face",tags:["unicorn","pony","horse","magic","fairy"],regions:[["face","path",{d:"M100 142 C100 84 220 84 220 142 C220 203 100 203 100 142 Z"}],["horn","path",{d:"M145 89 L160 35 L175 89 Z"}],["mane1","path",{d:"M116 104 C82 123 76 164 111 188 C100 160 104 130 116 104 Z"}],["ear1","path",{d:"M111 106 L82 62 L128 88 Z"}],["ear2","path",{d:"M209 106 L238 62 L192 88 Z"}],["eye1","circle",{cx:135,cy:139,r:8}],["eye2","circle",{cx:185,cy:139,r:8}],["nose1","circle",{cx:145,cy:177,r:5}],["nose2","circle",{cx:175,cy:177,r:5}]]},
  {id:"unicorn-side",name:"Magic Unicorn",tags:["unicorn","pony","horse","magic","rainbow"],regions:[["body","ellipse",{cx:164,cy:151,rx:70,ry:37}],["neck","path",{d:"M105 138 C93 95 122 73 153 95 C133 107 122 126 119 150 Z"}],["head","ellipse",{cx:90,cy:86,rx:38,ry:26,transform:"rotate(-14 90 86)"}],["horn","path",{d:"M70 62 L84 18 L94 68 Z"}],["ear","path",{d:"M111 65 L128 32 L132 73 Z"}],["tail","path",{d:"M229 139 C274 113 283 172 235 179"}],["leg1","rect",{x:123,y:178,width:14,height:44,rx:5}],["leg2","rect",{x:184,y:178,width:14,height:44,rx:5}],["eye","circle",{cx:78,cy:83,r:5}]]},
  {id:"unicorn-star",name:"Star Unicorn",tags:["unicorn","star","magic","sparkle","fairy"],regions:[["head","path",{d:"M100 168 C86 118 108 72 158 75 C209 78 236 123 214 169 C185 151 131 151 100 168 Z"}],["horn","path",{d:"M145 77 L166 22 L181 84 Z"}],["mane","path",{d:"M205 91 C246 111 242 164 211 188 C218 153 217 119 205 91 Z"}],["ear1","path",{d:"M111 91 L83 51 L129 75 Z"}],["ear2","path",{d:"M205 94 L235 55 L217 103 Z"}],["eye1","path",{d:"M124 126 Q139 138 154 126"}],["eye2","path",{d:"M172 126 Q187 138 202 126"}],["star1","path",{d:"M67 61 L73 75 L88 80 L74 87 L69 102 L61 88 L46 83 L60 75 Z"}],["star2","path",{d:"M253 55 L258 66 L270 70 L259 77 L255 89 L248 78 L236 74 L247 67 Z"}]]},
  {id:"castle",name:"Dream Castle",tags:["castle","princess","queen","king","fairy","dream","house"],regions:[["base","rect",{x:93,y:118,width:134,height:88,rx:8}],["tower1","rect",{x:61,y:98,width:48,height:108,rx:7}],["tower2","rect",{x:211,y:98,width:48,height:108,rx:7}],["roof1","path",{d:"M54 98 L85 50 L116 98 Z"}],["roof2","path",{d:"M204 98 L235 50 L266 98 Z"}],["roof3","path",{d:"M112 118 L160 64 L208 118 Z"}],["door","path",{d:"M142 206 L142 170 Q160 146 178 170 L178 206 Z"}],["window1","circle",{cx:85,cy:128,r:10}],["window2","circle",{cx:235,cy:128,r:10}],["window3","circle",{cx:160,cy:134,r:11}]]},
  {id:"rocket",name:"Space Rocket",tags:["space","rocket","planet","moon","star","galaxy"],regions:[["body","path",{d:"M160 38 C205 82 198 150 160 194 C122 150 115 82 160 38 Z"}],["window","circle",{cx:160,cy:99,r:20}],["fin1","path",{d:"M130 153 L91 202 L145 184 Z"}],["fin2","path",{d:"M190 153 L229 202 L175 184 Z"}],["flame","path",{d:"M145 194 C150 224 170 224 175 194 C168 206 152 206 145 194 Z"}],["star1","path",{d:"M66 62 L73 76 L89 78 L77 88 L80 104 L66 96 L52 104 L55 88 L43 78 L59 76 Z"}],["star2","path",{d:"M245 54 L250 65 L262 66 L253 74 L255 86 L245 80 L235 86 L237 74 L228 66 L240 65 Z"}]]},
  {id:"fish",name:"Ocean Fish",tags:["fish","ocean","sea","water","beach"],regions:[["body","ellipse",{cx:154,cy:128,rx:72,ry:43}],["tail","path",{d:"M222 128 L274 89 L270 128 L274 167 Z"}],["fin","path",{d:"M150 128 L120 178 L177 149 Z"}],["eye","circle",{cx:113,cy:116,r:8}],["bubble1","circle",{cx:70,cy:68,r:10}],["bubble2","circle",{cx:52,cy:102,r:7}],["bubble3","circle",{cx:251,cy:64,r:13}]]},
  {id:"cupcake",name:"Sweet Cupcake",tags:["cake","cupcake","sweet","birthday","food"],regions:[["wrapper","path",{d:"M96 128 L224 128 L205 214 L115 214 Z"}],["top1","circle",{cx:122,cy:121,r:31}],["top2","circle",{cx:160,cy:101,r:38}],["top3","circle",{cx:198,cy:121,r:31}],["cherry","circle",{cx:160,cy:50,r:13}],["stripe1","path",{d:"M126 143 L136 204"}],["stripe2","path",{d:"M160 138 L160 208"}],["stripe3","path",{d:"M194 143 L184 204"}]]},
  {id:"heart",name:"Love Heart",tags:["heart","love","mom","family","valentine"],regions:[["heart","path",{d:"M160 212 C73 156 53 82 103 60 C132 47 153 66 160 84 C167 66 188 47 217 60 C267 82 247 156 160 212 Z"}],["spark1","path",{d:"M66 76 L72 90 L87 96 L72 102 L66 116 L60 102 L45 96 L60 90 Z"}],["spark2","path",{d:"M252 118 L257 129 L269 134 L257 139 L252 150 L247 139 L235 134 L247 129 Z"}]]},
  {id:"house",name:"Cozy House",tags:["house","home","family","room"],regions:[["home","rect",{x:89,y:112,width:142,height:96,rx:7}],["roof","path",{d:"M72 116 L160 48 L248 116 Z"}],["door","rect",{x:143,y:158,width:34,height:50,rx:7}],["window1","rect",{x:105,y:134,width:28,height:25,rx:5}],["window2","rect",{x:187,y:134,width:28,height:25,rx:5}],["sun","circle",{cx:260,cy:54,r:20}]]},
];

function pickDrawingIdeas(theme){
  const q=theme.trim().toLowerCase();
  const matches=DRAWING_TEMPLATES.filter(t=>t.tags.some(tag=>q&&q.includes(tag)||q&&tag.includes(q)));
  const pool=[...matches,...DRAWING_TEMPLATES.filter(t=>!matches.some(m=>m.id===t.id))];
  const start=(q||"art").split("").reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%pool.length;
  const ideas=matches.slice(0,3);
  for(let i=0;ideas.length<3&&i<pool.length+3;i++){const item=pool[(start+i)%pool.length];if(!ideas.some(x=>x.id===item.id))ideas.push(item)}
  return ideas;
}

function DrawingGame({onBack}){
  const svgRef=useRef(null);
  const [mode,setMode]=useState("free");
  const [theme,setTheme]=useState("");
  const [ideas,setIdeas]=useState([]);
  const [template,setTemplate]=useState(null);
  const [tool,setTool]=useState("draw");
  const [color,setColor]=useState("#3B82F6");
  const [brush,setBrush]=useState(7);
  const [strokes,setStrokes]=useState([]);
  const [currentStroke,setCurrentStroke]=useState([]);
  const [drawing,setDrawing]=useState(false);
  const [fills,setFills]=useState({});
  const pathFromPoints=points=>points.length<2?"":points.reduce((d,p,i)=>d+(i?` L ${p.x} ${p.y}`:`M ${p.x} ${p.y}`),"");
  const resetArt=()=>{setStrokes([]);setCurrentStroke([]);setFills({});setDrawing(false)};
  const chooseMode=next=>{setMode(next);setTool(next==="free"?"draw":"trace");setTemplate(null);setIdeas([]);resetArt()};
  const pointFromEvent=e=>{const r=svgRef.current?.getBoundingClientRect();if(!r)return{x:0,y:0};return{x:((e.clientX-r.left)/r.width)*320,y:((e.clientY-r.top)/r.height)*240}};
  const startDraw=e=>{if(tool==="color")return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);setDrawing(true);setCurrentStroke([pointFromEvent(e)])};
  const moveDraw=e=>{if(!drawing||tool==="color")return;e.preventDefault();setCurrentStroke(p=>[...p,pointFromEvent(e)])};
  const finishDraw=e=>{if(!drawing)return;e.preventDefault();setDrawing(false);if(currentStroke.length>1)setStrokes(p=>[...p,{points:currentStroke,color,size:brush}]);setCurrentStroke([])};
  const makeIdeas=()=>{setIdeas(pickDrawingIdeas(theme||"rainbow"));setTemplate(null);resetArt();setTool("trace")};
  const selectTemplate=item=>{setTemplate(item);resetArt();setTool("trace")};
  const colorRegion=id=>{if(tool==="color")setFills(p=>({...p,[id]:color}))};
  const renderShape=([id,type,props],preview=false)=>{
    const common={key:id,stroke:"#374151",strokeWidth:preview?4:3,strokeLinecap:"round",strokeLinejoin:"round",fill:fills[id]||"#FFFFFF",vectorEffect:"non-scaling-stroke",onClick:()=>colorRegion(id),style:{cursor:tool==="color"&&!preview?"pointer":"default"}};
    if(type==="path")return <path {...common} {...props} fill={props.d?.includes("A")&&!props.d?.includes("Z")?"none":common.fill}/>;
    if(type==="ellipse")return <ellipse {...common} {...props}/>;
    if(type==="circle")return <circle {...common} {...props}/>;
    return <rect {...common} {...props}/>;
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={onBack} style={S.backBtn}>Back</button>
      <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,fontWeight:700,color:"#EC4899"}}>Drawing Studio</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
      {[{k:"free",l:"Free Draw",c:"#3B82F6"},{k:"theme",l:"Themed Drawing",c:"#EC4899"}].map(m=><button key={m.k} onClick={()=>chooseMode(m.k)} style={{padding:"10px",borderRadius:12,border:"none",fontFamily:"'Fredoka',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer",background:mode===m.k?`linear-gradient(135deg,${m.c},${m.c}CC)`:"#FFF",color:mode===m.k?"#FFF":m.c,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>{m.l}</button>)}
    </div>
    {mode==="theme"&&<div style={{padding:10,background:"#FFF",borderRadius:12,marginBottom:10}}>
      <div style={{display:"flex",gap:6}}>
        <input value={theme} onChange={e=>setTheme(e.target.value.slice(0,40))} placeholder="Type a theme..." style={{flex:1,padding:"9px 11px",borderRadius:10,border:"2px solid #FBCFE8",fontFamily:"'Nunito',sans-serif",fontSize:13,outline:"none"}}/>
        <button onClick={makeIdeas} style={{...BS,background:"linear-gradient(135deg,#F472B6,#EC4899)",color:"#FFF",fontSize:12}}>Make</button>
      </div>
      {ideas.length>0&&!template&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8}}>
        {ideas.map(item=><button key={item.id} onClick={()=>selectTemplate(item)} style={{padding:8,borderRadius:10,border:"2px solid #FCE7F3",background:"#FFF7FB",cursor:"pointer"}}>
          <svg viewBox="0 0 320 240" style={{width:"100%",height:58,display:"block"}}>{item.regions.map(r=>renderShape(r,true))}</svg>
          <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:10,fontWeight:700,color:"#9D174D",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
        </button>)}
      </div>}
    </div>}
    <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:8,paddingBottom:2}}>
      {DRAWING_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:30,height:30,borderRadius:8,border:color===c?"3px solid #111827":"2px solid #E5E7EB",background:c,cursor:"pointer",flex:"0 0 auto",boxShadow:c==="#FFFFFF"?"inset 0 0 0 1px #D1D5DB":"none"}} aria-label={`Color ${c}`}/>)}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      {[4,7,11].map(s=><button key={s} onClick={()=>setBrush(s)} style={{flex:1,padding:"7px 0",borderRadius:9,border:"none",background:brush===s?"#DBEAFE":"#FFF",color:brush===s?"#1D4ED8":"#6B7280",fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer"}}>{s===4?"Thin":s===7?"Paint":"Bold"}</button>)}
      {mode==="theme"&&template&&<button onClick={()=>setTool(tool==="color"?"trace":"color")} style={{flex:1,padding:"7px 0",borderRadius:9,border:"none",background:tool==="color"?"#FCE7F3":"#EDE9FE",color:tool==="color"?"#BE185D":"#6D28D9",fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer"}}>{tool==="color"?"Color":"Trace"}</button>}
    </div>
    <div style={{position:"relative",background:"#FFFDF7",border:"3px solid #FDE68A",borderRadius:16,overflow:"hidden",touchAction:"none",boxShadow:"0 4px 12px rgba(251,191,36,.15)"}}>
      <svg ref={svgRef} viewBox="0 0 320 240" onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={finishDraw} onPointerCancel={finishDraw} style={{width:"100%",height:300,display:"block",cursor:tool==="color"?"pointer":"crosshair",background:"linear-gradient(180deg,#FFFBEB,#FFF7ED)"}}>
        <defs><pattern id="drawing-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#FDE68A" strokeWidth=".5" opacity=".55"/></pattern></defs>
        <rect width="320" height="240" fill="url(#drawing-grid)"/>
        {template&&<g opacity={tool==="trace" ? .35 : 1}>{template.regions.map(r=>renderShape(r))}</g>}
        {strokes.map((s,i)=><path key={i} d={pathFromPoints(s.points)} fill="none" stroke={s.color} strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round"/>)}
        {currentStroke.length>1&&<path d={pathFromPoints(currentStroke)} fill="none" stroke={color} strokeWidth={brush} strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
      {mode==="theme"&&!template&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#BE185D",background:"rgba(255,255,255,.82)",padding:"8px 12px",borderRadius:10}}>Type a theme and pick an outline</div>
      </div>}
    </div>
    <div style={{display:"flex",gap:6,marginTop:8}}>
      <button onClick={()=>setStrokes(p=>p.slice(0,-1))} style={{...BS,flex:1,background:"#F3F4F6",color:"#4B5563"}}>Undo</button>
      <button onClick={resetArt} style={{...BS,flex:1,background:"#FEF2F2",color:"#DC2626"}}>Clear</button>
      {mode==="theme"&&template&&<button onClick={()=>{setTemplate(null);resetArt();}} style={{...BS,flex:1,background:"#FCE7F3",color:"#BE185D"}}>Ideas</button>}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MINI GAMES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MemoryGame({onBack,theme,onWin}){const emojis=CARD_SETS[theme]||CARD_SETS["🌸 Cherry Blossom"];const[cards,setCards]=useState([]);const[flipped,setFlipped]=useState([]);const[matched,setMatched]=useState([]);const[moves,setMoves]=useState(0);const[won,setWon]=useState(false);const init=useCallback(()=>{setCards([...emojis,...emojis].sort(()=>Math.random()-.5).map((e,i)=>({id:i,emoji:e})));setFlipped([]);setMatched([]);setMoves(0);setWon(false)},[emojis]);useEffect(()=>{init()},[init]);useEffect(()=>{if(!won&&matched.length===emojis.length*2&&matched.length>0){setWon(true);onWin()}},[won,matched,emojis.length,onWin]);useEffect(()=>{if(flipped.length===2){const[a,b]=flipped;if(cards[a].emoji===cards[b].emoji)setMatched(m=>[...m,a,b]);setTimeout(()=>setFlipped([]),600)}},[flipped,cards]);const handleFlip=i=>{if(flipped.length>=2||flipped.includes(i)||matched.includes(i))return;setFlipped(f=>[...f,i]);setMoves(m=>m+1)};const th=GAME_THEMES.find(t=>t.name===theme);const c=th?.colors||["#FFC0CB","#FF69B4","#FFB7C5"];return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><button onClick={onBack} style={S.backBtn}>← Back</button><span style={{fontFamily:"'Fredoka',sans-serif",color:"#6B7280",fontSize:13}}>Moves:{moves}</span><button onClick={init} style={{...S.backBtn,background:c[0]+"30",color:c[1]}}>🔄</button></div>{won&&<div style={{textAlign:"center",padding:14,background:`linear-gradient(135deg,${c[0]},${c[1]})`,borderRadius:14,marginBottom:10}}><div style={{fontSize:32}}>🎉</div><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,color:"#fff",fontWeight:600}}>Amazing! +15⭐</div></div>}<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>{cards.map((card,i)=>{const isF=flipped.includes(i)||matched.includes(i);return <div key={i} onClick={()=>handleFlip(i)} style={{height:64,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isF?24:18,cursor:"pointer",background:matched.includes(i)?`${c[2]}40`:isF?"#FFF":`linear-gradient(135deg,${c[0]},${c[1]})`,border:`2px solid ${matched.includes(i)?c[1]:"#E5E7EB"}`,boxShadow:isF?"0 2px 6px rgba(0,0,0,.06)":`0 3px 8px ${c[1]}25`,transition:"all .3s"}}>{isF?card.emoji:"✨"}</div>})}</div></div>)}
function MathGame({onBack,onScore}){const[score,setScore]=useState(0);const[q,setQ]=useState(null);const[fb,setFb]=useState(null);const[streak,setStreak]=useState(0);const pendingRef=useRef(0);const gen=()=>{const ops=["+","-","×"];const op=ops[Math.floor(Math.random()*ops.length)];let a,b,ans;if(op==="+"){a=Math.floor(Math.random()*50)+1;b=Math.floor(Math.random()*50)+1;ans=a+b}else if(op==="-"){a=Math.floor(Math.random()*50)+10;b=Math.floor(Math.random()*a);ans=a-b}else{a=Math.floor(Math.random()*12)+1;b=Math.floor(Math.random()*12)+1;ans=a*b}const ch=[ans];while(ch.length<4){const w=ans+(Math.floor(Math.random()*10)-5);if(w!==ans&&w>=0&&!ch.includes(w))ch.push(w)}ch.sort(()=>Math.random()-.5);setQ({a,b,op,answer:ans,choices:ch});setFb(null)};const flushScore=useCallback(()=>{if(pendingRef.current>0){onScore(pendingRef.current);pendingRef.current=0}},[onScore]);useEffect(()=>{gen();return flushScore},[flushScore]);const handle=c=>{if(fb||!q)return;if(c===q.answer){setScore(s=>s+10);setStreak(s=>s+1);setFb("correct");pendingRef.current+=2;setTimeout(gen,800)}else{setStreak(0);setFb("wrong");setTimeout(()=>setFb(null),800)}};const creatures=["🦊","🐉","🦄","🐬","🦋","🐧"];return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><button onClick={()=>{flushScore();onBack()}} style={S.backBtn}>← Back</button><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontFamily:"'Fredoka',sans-serif",color:"#FF6B6B",fontWeight:600,fontSize:13}}>🏆{score}</span>{streak>=3&&<span style={{fontFamily:"'Fredoka',sans-serif",color:"#FBBF24",fontWeight:600,fontSize:12}}>🔥{streak}x</span>}</div></div><div style={{textAlign:"center",padding:20,background:"linear-gradient(135deg,#FFF1F2,#FFE4E6)",borderRadius:18}}><div style={{fontSize:42,marginBottom:4}}>{creatures[(score/10)%creatures.length|0]}</div>{q&&<><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:32,color:"#1F2937",fontWeight:700,marginBottom:16}}>{q.a} {q.op} {q.b} = ?</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,maxWidth:240,margin:"0 auto"}}>{q.choices.map((c,i)=><button key={i} onClick={()=>handle(c)} style={{padding:"12px 0",borderRadius:11,border:"none",fontSize:18,fontFamily:"'Fredoka',sans-serif",fontWeight:600,cursor:"pointer",background:"#FFF",color:"#1F2937",boxShadow:"0 2px 6px rgba(0,0,0,.05)"}}>{c}</button>)}</div></>}{fb&&<div style={{marginTop:12,fontFamily:"'Fredoka',sans-serif",fontSize:18,color:fb==="correct"?"#34D399":"#FF6B6B",fontWeight:600}}>{fb==="correct"?"✨ Correct! +2⭐":"Oops! Try again!"}</div>}</div></div>)}

function RiddleGame({onBack,onScore}){
  const[idx,setIdx]=useState(()=>Math.floor(Math.random()*RIDDLES.length));
  const[showAnswer,setShowAnswer]=useState(false);
  const[showHint,setShowHint]=useState(false);
  const[solved,setSolved]=useState(0);
  const[tried,setTried]=useState(new Set());
  const[pendingStars,setPendingStars]=useState(0);
  const pendingStarsRef=useRef(0);
  const riddle=RIDDLES[idx];
  const flushRiddleScore=useCallback(()=>{if(pendingStarsRef.current>0){onScore(pendingStarsRef.current);pendingStarsRef.current=0;setPendingStars(0)}},[onScore]);
  useEffect(()=>flushRiddleScore,[flushRiddleScore]);
  const next=()=>{flushRiddleScore();let n;do{n=Math.floor(Math.random()*RIDDLES.length)}while(n===idx&&RIDDLES.length>1);setIdx(n);setShowAnswer(false);setShowHint(false)};
  const reveal=()=>{if(!showAnswer){setShowAnswer(true);if(!tried.has(idx)){setTried(p=>new Set([...p,idx]));setSolved(s=>s+1);pendingStarsRef.current+=3;setPendingStars(p=>p+3)}}};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={()=>{flushRiddleScore();onBack()}} style={S.backBtn}>← Back</button>
      <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,color:"#FBBF24",fontWeight:600}}>🧩 {solved} solved</span>
    </div>
    <div style={{background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",borderRadius:18,padding:"20px 16px",marginBottom:12,textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:8}}>
        <span style={{padding:"2px 8px",borderRadius:6,background:"#FFF8",fontFamily:"'Nunito',sans-serif",fontSize:10,color:"#92400E"}}>{riddle.cat}</span>
      </div>
      <div style={{fontSize:36,marginBottom:8}}>🤔</div>
      <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,fontWeight:700,color:"#1F2937",lineHeight:1.5}}>{riddle.q}</div>
    </div>
    {showHint&&!showAnswer&&(
      <div style={{padding:"10px 14px",background:"#FFF7ED",borderRadius:12,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>💡</span>
        <span style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#92400E",fontStyle:"italic"}}>{riddle.hint}</span>
      </div>
    )}
    {showAnswer?(
      <div style={{padding:"16px",background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",borderRadius:16,marginBottom:12,textAlign:"center",animation:"popBounce .4s ease"}}>
        <div style={{fontSize:28,marginBottom:4}}>🎉</div>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,fontWeight:700,color:"#065F46"}}>{riddle.a}</div>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,color:"#059669",marginTop:4}}>+3⭐ earned!</div>
        <style>{`@keyframes popBounce{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
      </div>
    ):(
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {!showHint&&<button onClick={()=>setShowHint(true)} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid #FDE68A",background:"#FFFBEB",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:600,color:"#92400E",cursor:"pointer"}}>💡 Hint</button>}
        <button onClick={reveal} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#FBBF24,#F59E0B)",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(251,191,36,.3)"}}>👀 Show Answer!</button>
      </div>
    )}
    <button onClick={next} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#A78BFA,#7C3AED)",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(124,58,237,.3)"}}>🔄 Next Riddle!</button>
  </div>);
}

function TongueTwisterGame({onBack}){
  const[idx,setIdx]=useState(0);
  const[speed,setSpeed]=useState("all");
  const[attempts,setAttempts]=useState(0);
  const[bestStreak,setBestStreak]=useState(0);
  const[currentStreak,setCurrentStreak]=useState(0);
  const[showResult,setShowResult]=useState(null);
  const filtered=speed==="all"?TONGUE_TWISTERS:TONGUE_TWISTERS.filter(t=>t.level===(speed==="easy"?1:speed==="medium"?2:3));
  const tw=filtered[idx%filtered.length];
  const next=()=>{setIdx(i=>(i+1)%filtered.length);setShowResult(null)};
  const markResult=(nailed)=>{
    setAttempts(a=>a+1);
    if(nailed){const ns=currentStreak+1;setCurrentStreak(ns);if(ns>bestStreak)setBestStreak(ns);setShowResult("nailed")}
    else{setCurrentStreak(0);setShowResult("oops")}
    setTimeout(()=>{next()},1200);
  };
  const levelColors={1:"#34D399",2:"#FBBF24",3:"#EF4444"};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,color:"#6B7280"}}>🎯{attempts}</span>
        {bestStreak>0&&<span style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,color:"#FBBF24"}}>🔥{bestStreak}</span>}
      </div>
    </div>
    <div style={{display:"flex",gap:3,marginBottom:12}}>
      {[{k:"all",l:"All"},{k:"easy",l:"🐢 Easy"},{k:"medium",l:"🐇 Medium"},{k:"hard",l:"🏎️ Hard"}].map(f=>
        <button key={f.k} onClick={()=>{setSpeed(f.k);setIdx(0);setShowResult(null)}} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",fontFamily:"'Fredoka',sans-serif",fontSize:10,fontWeight:600,cursor:"pointer",background:speed===f.k?"linear-gradient(135deg,#A78BFA,#7C3AED)":"#F3F4F6",color:speed===f.k?"#FFF":"#6B7280"}}>{f.l}</button>
      )}
    </div>
    <div style={{background:"linear-gradient(135deg,#EDE9FE,#DDD6FE)",borderRadius:18,padding:"20px 16px",marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:6}}>{tw.emoji}</div>
      <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:8}}>
        <span style={{padding:"2px 8px",borderRadius:6,background:levelColors[tw.level]+"30",fontFamily:"'Nunito',sans-serif",fontSize:10,fontWeight:600,color:levelColors[tw.level]}}>{tw.speed}</span>
      </div>
      <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:20,fontWeight:700,color:"#1F2937",lineHeight:1.5,letterSpacing:".3px"}}>{tw.text}</div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:"#7C3AED",marginTop:8,fontStyle:"italic"}}>Try saying it 3 times fast!</div>
    </div>
    {showResult?(
      <div style={{padding:14,borderRadius:14,textAlign:"center",marginBottom:12,background:showResult==="nailed"?"linear-gradient(135deg,#D1FAE5,#A7F3D0)":"linear-gradient(135deg,#FEF2F2,#FECACA)",animation:"popBounce .3s ease"}}>
        <div style={{fontSize:28}}>{showResult==="nailed"?"🎉":"😂"}</div>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:16,fontWeight:700,color:showResult==="nailed"?"#065F46":"#991B1B"}}>{showResult==="nailed"?"Nailed it!":"Tongue-tied! Try again!"}</div>
        {showResult==="nailed"&&currentStreak>1&&<div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#059669"}}>🔥 {currentStreak} in a row!</div>}
        <style>{`@keyframes popBounce{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
      </div>
    ):(
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>markResult(true)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#34D399,#059669)",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(5,150,105,.3)"}}>✅ Nailed it!</button>
        <button onClick={()=>markResult(false)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#F472B6,#EC4899)",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(236,72,153,.3)"}}>😵 Tongue-tied!</button>
      </div>
    )}
    <button onClick={next} style={{width:"100%",padding:"10px",borderRadius:10,border:"2px solid #E5E7EB",background:"#FFF",fontFamily:"'Fredoka',sans-serif",fontSize:13,fontWeight:600,color:"#6B7280",cursor:"pointer"}}>⏭️ Skip to next</button>
  </div>);
}

function JokeGame({onBack}){
  const[idx,setIdx]=useState(()=>Math.floor(Math.random()*JOKES.length));
  const[showPunchline,setShowPunchline]=useState(false);
  const[rating,setRating]=useState(null);
  const[favorites,setFavorites]=useState([]);
  const[showFavs,setShowFavs]=useState(false);
  const joke=JOKES[idx];
  const next=()=>{let n;do{n=Math.floor(Math.random()*JOKES.length)}while(n===idx&&JOKES.length>1);setIdx(n);setShowPunchline(false);setRating(null)};
  const toggleFav=()=>{if(favorites.includes(idx))setFavorites(f=>f.filter(i=>i!==idx));else setFavorites(f=>[...f,idx])};
  if(showFavs){
    return(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={()=>setShowFavs(false)} style={S.backBtn}>← Back</button>
        <span style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,color:"#FBBF24"}}>⭐ {favorites.length} saved</span>
      </div>
      {favorites.length===0?<div style={{textAlign:"center",padding:24}}><div style={{fontSize:36}}>😄</div><div style={{fontFamily:"'Fredoka',sans-serif",color:"#9CA3AF",marginTop:6}}>No favorites yet!</div></div>:
      favorites.map((fi,i)=>{const j=JOKES[fi];return <div key={i} style={{padding:12,background:"#FFF",borderRadius:12,marginBottom:6,boxShadow:"0 1px 2px rgba(0,0,0,.02)"}}>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,fontWeight:600,color:"#1F2937"}}>{j.setup}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#059669",marginTop:4}}>{j.punchline}</div>
      </div>})}
    </div>);
  }
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <button onClick={()=>setShowFavs(true)} style={{...BS,fontSize:11,padding:"4px 10px",background:"#FFFBEB",color:"#92400E"}}>⭐ Faves ({favorites.length})</button>
    </div>
    <div style={{background:"linear-gradient(135deg,#DBEAFE,#BFDBFE)",borderRadius:18,padding:"20px 16px",marginBottom:12,textAlign:"center",position:"relative"}}>
      <button onClick={toggleFav} style={{position:"absolute",top:10,right:10,background:"none",border:"none",fontSize:18,cursor:"pointer"}}>{favorites.includes(idx)?"⭐":"☆"}</button>
      <span style={{padding:"2px 8px",borderRadius:6,background:"#FFF8",fontFamily:"'Nunito',sans-serif",fontSize:10,color:"#1E40AF"}}>{joke.cat}</span>
      <div style={{fontSize:40,margin:"10px 0"}}>😄</div>
      <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,fontWeight:700,color:"#1F2937",lineHeight:1.5}}>{joke.setup}</div>
    </div>
    {showPunchline?(
      <div style={{padding:"16px",background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",borderRadius:16,marginBottom:12,textAlign:"center",animation:"popBounce .4s ease"}}>
        <div style={{fontSize:28,marginBottom:4}}>🤣</div>
        <div style={{fontFamily:"'Fredoka',sans-serif",fontSize:17,fontWeight:700,color:"#92400E",lineHeight:1.4}}>{joke.punchline}</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10}}>
          {[{e:"😐",l:"Meh"},{e:"😊",l:"Funny"},{e:"🤣",l:"LOL!"},{e:"💀",l:"I'm dead"}].map((r,i)=>
            <button key={i} onClick={()=>setRating(i)} style={{padding:"6px 10px",borderRadius:10,border:rating===i?"2px solid #FBBF24":"2px solid #E5E7EB",background:rating===i?"#FFFBEB":"#FFF",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"all .2s"}}>
              <span style={{fontSize:18}}>{r.e}</span>
              <span style={{fontFamily:"'Nunito',sans-serif",fontSize:8,color:"#6B7280"}}>{r.l}</span>
            </button>
          )}
        </div>
        <style>{`@keyframes popBounce{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
      </div>
    ):(
      <button onClick={()=>setShowPunchline(true)} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#FBBF24,#F59E0B)",fontFamily:"'Fredoka',sans-serif",fontSize:16,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 14px rgba(251,191,36,.35)",marginBottom:12}}>
        🥁 Show Punchline!
      </button>
    )}
    <button onClick={next} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#60A5FA,#3B82F6)",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:700,color:"#FFF",cursor:"pointer",boxShadow:"0 4px 12px rgba(59,130,246,.3)"}}>😂 Next Joke!</button>
  </div>);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI CHAT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AiChat({onClose}){const[messages,setMessages]=useState([{role:"assistant",text:"Hi Ava! 🌟 Ask me anything!"}]);const[input,setInput]=useState("");const[loading,setLoading]=useState(false);const scrollRef=useRef(null);const[dragY,setDragY]=useState(0);const dragStart=useRef(null);const dragging=useRef(false);useEffect(()=>{scrollRef.current?.scrollTo(0,scrollRef.current.scrollHeight)},[messages]);const send=async()=>{if(!input.trim()||loading)return;const userMsg=input.trim();setInput("");setMessages(m=>[...m,{role:"user",text:userMsg}]);setLoading(true);try{const apiMsgs=[...messages.filter((m,i)=>m.role!=="assistant"||i!==0),{role:"user",content:userMsg}].map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text||m.content})).slice(-10);const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"Friendly AI buddy for 8-year-old Ava. Simple fun language, emojis, 2-4 sentences. Educational!",messages:apiMsgs,tools:[{type:"web_search_20250305",name:"web_search"}]})});const data=await res.json();const text=data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"Try again! 🌈";setMessages(m=>[...m,{role:"assistant",text}])}catch(e){setMessages(m=>[...m,{role:"assistant",text:"Oops! Try again! 🌀"}])}setLoading(false)};const onTouchStart=e=>{const t=e.touches[0].clientY;dragStart.current=t;dragging.current=false};const onTouchMove=e=>{if(dragStart.current===null)return;const dy=e.touches[0].clientY-dragStart.current;if(dy>10)dragging.current=true;if(dragging.current&&dy>0){setDragY(dy);e.preventDefault()}};const onTouchEnd=()=>{if(dragY>120){onClose()}setDragY(0);dragStart.current=null;dragging.current=false};return(<div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",flexDirection:"column",background:"rgba(0,0,0,.3)"}} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}><div style={{flex:1,display:"flex",flexDirection:"column",background:"#F8F7FF",marginTop:Math.max(0,dragY),borderTopLeftRadius:dragY>0?20:0,borderTopRightRadius:dragY>0?20:0,transition:dragY===0?"margin-top .25s ease":"none",opacity:dragY>80?0.7:1}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 16px 0",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",flexShrink:0,borderTopLeftRadius:dragY>0?20:0,borderTopRightRadius:dragY>0?20:0}}><div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,.45)",marginBottom:6}} /><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",paddingBottom:10}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:18,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div><div><div style={{fontFamily:"'Fredoka',sans-serif",fontWeight:700,fontSize:16,color:"#FFF"}}>AI Buddy</div><div style={{fontFamily:"'Nunito',sans-serif",fontSize:9,color:"rgba(255,255,255,.6)"}}>Swipe down to close</div></div></div><button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,padding:"6px 12px",color:"#FFF",fontFamily:"'Fredoka',sans-serif",fontSize:13,cursor:"pointer"}}>✕</button></div></div><div ref={scrollRef} style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>{messages.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:16,background:m.role==="user"?"linear-gradient(135deg,#A78BFA,#7C3AED)":"#FFF",color:m.role==="user"?"#FFF":"#1F2937",fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.5,boxShadow:"0 1px 4px rgba(0,0,0,.05)",borderBottomRightRadius:m.role==="user"?4:16,borderBottomLeftRadius:m.role==="user"?16:4}}>{m.text}</div></div>)}{loading&&<div style={{display:"flex"}}><div style={{padding:"10px 16px",borderRadius:16,background:"#FFF",fontFamily:"'Nunito',sans-serif",fontSize:14,color:"#9CA3AF"}}>Thinking...</div></div>}</div><div style={{padding:"6px 14px",display:"flex",gap:6,overflowX:"auto",flexShrink:0}}>{["Why is sky blue?","Dinosaurs 🦕","How planes fly? ✈️","Fun fact!"].map((s,i)=><button key={i} onClick={()=>setInput(s)} style={{flexShrink:0,padding:"6px 12px",borderRadius:20,border:"1px solid #E5E7EB",background:"#FFF",fontFamily:"'Nunito',sans-serif",fontSize:11,color:"#6B7280",cursor:"pointer",whiteSpace:"nowrap"}}>{s}</button>)}</div><div style={{display:"flex",gap:8,padding:"10px 14px 16px",background:"#FFF",borderTop:"1px solid #F3F4F6",flexShrink:0}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything..." style={{flex:1,padding:"10px 14px",borderRadius:12,border:"2px solid #E5E7EB",fontFamily:"'Nunito',sans-serif",fontSize:14,outline:"none"}}/><button onClick={send} disabled={loading||!input.trim()} style={{padding:"10px 16px",borderRadius:12,border:"none",background:input.trim()?"linear-gradient(135deg,#A78BFA,#7C3AED)":"#E5E7EB",color:input.trim()?"#FFF":"#9CA3AF",fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>Send</button></div></div></div>)}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOVE TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoveTab({loveLog,onKiss,onLoveYou}){const now=new Date();const todayKey=makeDateKey(now);const todayData=loveLog[todayKey]||{kisses:0,loveyous:0};const[calMonth,setCalMonth]=useState(now.getMonth());const[calYear,setCalYear]=useState(now.getFullYear());const[kissAnim,setKissAnim]=useState(false);const[heartAnim,setHeartAnim]=useState(false);const[selDay,setSelDay]=useState(null);const[floats,setFloats]=useState([]);const floatId=useRef(0);
  const allKeys=Object.keys(loveLog);const totalK=allKeys.reduce((s,k)=>s+(loveLog[k].kisses||0),0);const totalL=allKeys.reduce((s,k)=>s+(loveLog[k].loveyous||0),0);
  const firstDay=new Date(calYear,calMonth,1).getDay();const daysInMonth=new Date(calYear,calMonth+1,0).getDate();const calDays=[];for(let i=0;i<firstDay;i++)calDays.push(null);for(let d=1;d<=daysInMonth;d++)calDays.push(d);
  const getKey=day=>`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const isToday=day=>day===now.getDate()&&calMonth===now.getMonth()&&calYear===now.getFullYear();
  const getHeat=day=>{const data=loveLog[getKey(day)];if(!data)return"transparent";const t=(data.kisses||0)+(data.loveyous||0);return t>=15?"#EC4899":t>=10?"#F472B6":t>=5?"#FBCFE8":t>=1?"#FCE7F3":"transparent"};
  const selData=selDay?loveLog[getKey(selDay)]:null;
  const doKiss=()=>{onKiss();setKissAnim(true);setTimeout(()=>setKissAnim(false),400);const id=floatId.current++;const newFloats=Array.from({length:4},(_,i)=>({id:`${id}-${i}`,emoji:"💋",x:30+Math.random()*40,delay:i*0.08}));setFloats(f=>[...f,...newFloats]);setTimeout(()=>setFloats(f=>f.filter(fl=>!newFloats.find(n=>n.id===fl.id))),1800)};
  const doHeart=()=>{onLoveYou();setHeartAnim(true);setTimeout(()=>setHeartAnim(false),400);const id=floatId.current++;const newFloats=Array.from({length:4},(_,i)=>({id:`${id}-${i}`,emoji:"❤️",x:30+Math.random()*40,delay:i*0.08}));setFloats(f=>[...f,...newFloats]);setTimeout(()=>setFloats(f=>f.filter(fl=>!newFloats.find(n=>n.id===fl.id))),1800)};
  return(<div style={{position:"relative"}}>
  {floats.length>0&&<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}>{floats.map(f=><div key={f.id} style={{position:"absolute",left:`${f.x}%`,bottom:"35%",fontSize:28,animation:`loveFloat 1.4s ease-out ${f.delay}s forwards`,opacity:0}}>{f.emoji}</div>)}<style>{`@keyframes loveFloat{0%{transform:translateY(0) scale(.4);opacity:0}20%{opacity:1;transform:translateY(-30px) scale(1.3)}100%{transform:translateY(-200px) scale(.2);opacity:0}}`}</style></div>}
  <div style={{textAlign:"center",padding:"16px 14px",background:"linear-gradient(135deg,#FDF2F8,#FCE7F3,#FFF1F2)",borderRadius:16,marginBottom:12,position:"relative",overflow:"hidden"}}><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:20,fontWeight:700,color:"#9D174D",marginBottom:3}}>Mom's Love Counter 💕</div><div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#BE185D",fontStyle:"italic"}}>"{LOVE_QUOTES[now.getDate()%LOVE_QUOTES.length]}"</div></div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
    <div style={{background:"#FFF",borderRadius:16,padding:"14px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(236,72,153,.1)",border:"2px solid #FCE7F3"}}><div style={{fontFamily:"'Nunito',sans-serif",fontSize:10,color:"#9CA3AF"}}>Kisses Today</div><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:34,fontWeight:700,color:"#EC4899",transition:"transform .15s",transform:kissAnim?"scale(1.2)":"scale(1)"}}>{todayData.kisses}</div><button onClick={doKiss} style={{marginTop:8,width:64,height:64,borderRadius:32,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#EC4899,#F472B6)",fontSize:28,boxShadow:"0 4px 14px rgba(236,72,153,.35)",transition:"transform .15s",transform:kissAnim?"scale(.88)":"scale(1)"}}>💋</button></div>
    <div style={{background:"#FFF",borderRadius:16,padding:"14px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(239,68,68,.1)",border:"2px solid #FEE2E2"}}><div style={{fontFamily:"'Nunito',sans-serif",fontSize:10,color:"#9CA3AF"}}>I Love You's</div><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:34,fontWeight:700,color:"#EF4444",transition:"transform .15s",transform:heartAnim?"scale(1.2)":"scale(1)"}}>{todayData.loveyous}</div><button onClick={doHeart} style={{marginTop:8,width:64,height:64,borderRadius:32,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#EF4444,#F87171)",fontSize:28,boxShadow:"0 4px 14px rgba(239,68,68,.35)",transition:"transform .15s",transform:heartAnim?"scale(.88)":"scale(1)"}}>❤️</button></div>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:14}}>{[{v:totalK,l:"All 💋",bg:"#FFF1F2",c:"#EC4899"},{v:totalL,l:"All ❤️",bg:"#FEF2F2",c:"#EF4444"},{v:allKeys.length,l:"Days",bg:"#FDF4FF",c:"#A855F7"}].map((x,i)=><div key={i} style={{padding:"8px 4px",borderRadius:10,background:x.bg,textAlign:"center"}}><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:16,fontWeight:700,color:x.c}}>{x.v}</div><div style={{fontFamily:"'Nunito',sans-serif",fontSize:9,color:"#9CA3AF"}}>{x.l}</div></div>)}</div>
  <div style={{background:"#FFF",borderRadius:14,padding:12,boxShadow:"0 2px 6px rgba(0,0,0,.04)",marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><button onClick={()=>{calMonth===0?(setCalMonth(11),setCalYear(y=>y-1)):setCalMonth(m=>m-1);setSelDay(null)}} style={{...BS,background:"#F3F4F6",color:"#6B7280",padding:"4px 9px"}}>←</button><span style={{fontFamily:"'Fredoka',sans-serif",fontSize:14,fontWeight:600,color:"#1F2937"}}>{MONTHS[calMonth]} {calYear}</span><button onClick={()=>{calMonth===11?(setCalMonth(0),setCalYear(y=>y+1)):setCalMonth(m=>m+1);setSelDay(null)}} style={{...BS,background:"#F3F4F6",color:"#6B7280",padding:"4px 9px"}}>→</button></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:3}}>{["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontFamily:"'Fredoka',sans-serif",fontSize:9,color:"#9CA3AF",padding:2}}>{d}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{calDays.map((day,i)=>{if(!day)return <div key={i}/>;const heat=getHeat(day);const isTdy=isToday(day);const isSel=selDay===day;const data=loveLog[getKey(day)];const has=data&&(data.kisses>0||data.loveyous>0);return <div key={i} onClick={()=>setSelDay(isSel?null:day)} style={{textAlign:"center",padding:"5px 2px",borderRadius:7,cursor:has?"pointer":"default",background:isSel?"linear-gradient(135deg,#EC4899,#F472B6)":heat!=="transparent"?heat:isTdy?"#EDE9FE":"transparent",border:isTdy?"2px solid #A78BFA":"2px solid transparent"}}><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:11,fontWeight:isTdy?700:500,color:isSel?"#FFF":isTdy?"#7C3AED":heat!=="transparent"?"#9D174D":"#6B7280"}}>{day}</div>{has&&!isSel&&<div style={{display:"flex",justifyContent:"center",gap:1,marginTop:1}}>{data.kisses>0&&<span style={{fontSize:6}}>💋</span>}{data.loveyous>0&&<span style={{fontSize:6}}>❤️</span>}</div>}</div>})}</div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginTop:8}}><span style={{fontFamily:"'Nunito',sans-serif",fontSize:8,color:"#9CA3AF"}}>Less</span>{["#FFF","#FCE7F3","#FBCFE8","#F472B6","#EC4899"].map((c,i)=><div key={i} style={{width:12,height:12,borderRadius:3,background:c,border:"1px solid #F3F4F6"}}/>)}<span style={{fontFamily:"'Nunito',sans-serif",fontSize:8,color:"#9CA3AF"}}>More!</span></div>
  </div>
  {selDay&&selData&&<div style={{padding:12,background:"linear-gradient(135deg,#FDF2F8,#FCE7F3)",borderRadius:12,marginBottom:10}}><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:13,fontWeight:600,color:"#9D174D",marginBottom:6}}>{SHORT_MONTHS[calMonth]} {selDay}</div><div style={{display:"flex",gap:14}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:20}}>💋</span><div><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,fontWeight:700,color:"#EC4899"}}>{selData.kisses}</div></div></div><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:20}}>❤️</span><div><div style={{fontFamily:"'Fredoka',sans-serif",fontSize:18,fontWeight:700,color:"#EF4444"}}>{selData.loveyous}</div></div></div></div></div>}
  </div>)}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEM LAB TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CraftTab({ onEarnStars }) {
  const [filter, setFilter] = useState("🔬 All");
  const [activeActivity, setActiveActivity] = useState(null);
  const [completedSteps, setCompletedSteps] = useState({});
  const [completedActivities, setCompletedActivities] = useState([]);
  const [showScience, setShowScience] = useState(false);

  const filtered = filter === "🔬 All" ? STEM_ACTIVITIES : STEM_ACTIVITIES.filter(a => a.cat === filter);

  const toggleStep = (actId, stepIdx) => {
    setCompletedSteps(prev => {
      const key = `${actId}-${stepIdx}`;
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
  };

  const stepsCompleted = (act) => act.steps.filter((_, i) => completedSteps[`${act.id}-${i}`]).length;

  const finishActivity = (act) => {
    setCompletedActivities(prev => [...prev, act.id]);
    onEarnStars(act.stars);
    setActiveActivity(null);
  };

  // Detail view
  if (activeActivity) {
    const act = activeActivity;
    const done = stepsCompleted(act);
    const allDone = done === act.steps.length;
    const alreadyCompleted = completedActivities.includes(act.id);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => { setActiveActivity(null); setShowScience(false); }} style={S.backBtn}>← Back</button>
          <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 10, color: "#9CA3AF" }}>{done}/{act.steps.length} steps</span>
        </div>

        {/* Header card */}
        <div style={{ background: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>{act.icon}</span>
            <div>
              <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 16, fontWeight: 700, color: "#1F2937" }}>{act.title}</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>{act.cat} · {act.time} · Ages {act.ages} · +{act.stars}⭐</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, color: "#5B21B6", fontStyle: "italic", background: "rgba(255,255,255,.5)", borderRadius: 8, padding: "6px 10px" }}>🤔 {act.question}</div>
        </div>

        {/* Materials */}
        <div style={{ background: "#FFF", borderRadius: 12, padding: 12, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#1F2937", marginBottom: 6 }}>📦 What You Need</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {act.materials.map((m, i) => <span key={i} style={{ padding: "3px 8px", borderRadius: 6, background: "#F3F4F6", fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#4B5563" }}>{m}</span>)}
          </div>
        </div>

        {/* Steps */}
        <div style={{ background: "#FFF", borderRadius: 12, padding: 12, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>📋 Instructions</div>
          {act.steps.map((step, i) => {
            const checked = completedSteps[`${act.id}-${i}`];
            return <div key={i} onClick={() => toggleStep(act.id, i)} style={{ display: "flex", gap: 8, padding: "8px 6px", cursor: "pointer", borderBottom: i < act.steps.length - 1 ? "1px solid #F3F4F6" : "none", opacity: checked ? .6 : 1 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? "#34D399" : "#D1D5DB"}`, background: checked ? "#34D399" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 10, flexShrink: 0, marginTop: 1 }}>{checked ? "✓" : i + 1}</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 12, lineHeight: 1.5, color: "#1F2937", textDecoration: checked ? "line-through" : "none" }}>{step}</div>
            </div>;
          })}
        </div>

        {/* Science explanation */}
        <button onClick={() => setShowScience(!showScience)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: showScience ? "linear-gradient(135deg,#DBEAFE,#BFDBFE)" : "#F0F9FF", cursor: "pointer", fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: "#1E40AF", textAlign: "left", marginBottom: 8 }}>
          🧠 {showScience ? "Hide" : "Show"} the Science!
        </button>
        {showScience && <div style={{ padding: 10, background: "#F0F9FF", borderRadius: 10, marginBottom: 8 }}>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, lineHeight: 1.6, color: "#1E40AF" }}>{act.science}</div>
          {act.tryThis && <div style={{ marginTop: 6, padding: "6px 8px", background: "#FEF3C7", borderRadius: 7, fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#92400E" }}>💡 Try This: {act.tryThis}</div>}
        </div>}

        {/* Complete button */}
        {!alreadyCompleted && <button onClick={() => allDone && finishActivity(act)} disabled={!allDone} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: allDone ? "linear-gradient(135deg,#34D399,#059669)" : "#E5E7EB", fontFamily: "'Fredoka',sans-serif", fontSize: 13, fontWeight: 600, color: allDone ? "#FFF" : "#9CA3AF", cursor: allDone ? "pointer" : "default" }}>
          {allDone ? `Done! Earn +${act.stars}⭐` : `Complete all ${act.steps.length} steps first`}
        </button>}
        {alreadyCompleted && <div style={{ textAlign: "center", padding: 10, background: "#F0FDF4", borderRadius: 10, fontFamily: "'Fredoka',sans-serif", fontSize: 12, color: "#059669" }}>✅ Already completed! Great job!</div>}
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={S.sectionHeader}><span>🔬 STEM Lab</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: "#9CA3AF" }}>{completedActivities.length}/{STEM_ACTIVITIES.length}</span></div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 3, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {STEM_CATEGORIES.map(c => <button key={c} onClick={() => setFilter(c)} style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 7, border: "none", fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", background: filter === c ? "linear-gradient(135deg,#A78BFA,#7C3AED)" : "#F3F4F6", color: filter === c ? "#FFF" : "#6B7280" }}>{c}</button>)}
      </div>

      {/* Activity cards */}
      {filtered.map(act => {
        const done = completedActivities.includes(act.id);
        return <div key={act.id} onClick={() => setActiveActivity(act)} style={{ padding: 12, marginBottom: 8, borderRadius: 12, background: done ? "#F0FDF4" : "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,.03)", cursor: "pointer", border: done ? "2px solid #34D399" : "2px solid transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: done ? "#D1FAE5" : "linear-gradient(135deg,#EDE9FE,#DDD6FE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{done ? "✅" : act.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: 13, color: "#1F2937" }}>{act.title}</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>{act.cat} · {act.time} · {"⭐".repeat(act.difficulty)}</div>
            </div>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: "#FBBF24", fontWeight: 600, flexShrink: 0 }}>+{act.stars}⭐</div>
          </div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#4B5563", marginTop: 4, fontStyle: "italic" }}>🤔 {act.question}</div>
        </div>;
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAT ROOM TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CHAT_AVATARS = ["🦄","🐱","🦋","🐬","🌸","🐰","🦊","🐼","🌈","⭐","🎀","🐝","🦩","🍓","🌺"];
const CHAT_COLORS = ["#EC4899","#8B5CF6","#3B82F6","#059669","#F59E0B","#EF4444","#6366F1","#14B8A6","#F97316","#A855F7","#06B6D4","#E11D48","#7C3AED","#D946EF","#0EA5E9"];
const CHAT_STICKERS = ["👋","😂","❤️","🎉","👍","✨","💕","🌟","😊","🤗","💪","🎨","📚","🦄","🌈"];

function AccountSetup({ onCreate, title = "Create Account", subtitle = "Set up your profile to start Ava's World!" }) {
  const [setupName, setSetupName] = useState("");
  const [setupAge, setSetupAge] = useState("");
  const [setupAvatar, setSetupAvatar] = useState("🦄");
  const canCreate = setupName.trim() && Number(setupAge) > 0;
  return (
    <div>
      <div style={{ textAlign: "center", padding: "20px 14px", background: "linear-gradient(135deg, #EDE9FE, #DDD6FE, #FDF2F8)", borderRadius: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>🌸</div>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 700, color: "#5B21B6" }}>{title}</div>
        <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 13, color: "#7C3AED", marginTop: 3 }}>{subtitle}</div>
      </div>
      <div style={{ background: "#FFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 14, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>Pick your avatar:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {CHAT_AVATARS.map(a => (
            <button key={a} onClick={() => setSetupAvatar(a)} style={{
              width: 42, height: 42, borderRadius: 12, border: setupAvatar === a ? "3px solid #7C3AED" : "2px solid #E5E7EB",
              background: setupAvatar === a ? "#EDE9FE" : "#FFF", fontSize: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s",
              transform: setupAvatar === a ? "scale(1.1)" : "scale(1)",
            }}>{a}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 14, fontWeight: 600, color: "#1F2937", marginBottom: 6 }}>Name:</div>
            <input value={setupName} onChange={e => setSetupName(e.target.value.slice(0, 18))} placeholder="Ava" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 14, fontWeight: 600, color: "#1F2937", marginBottom: 6 }}>Age:</div>
            <input value={setupAge} onChange={e => setSetupAge(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="8" inputMode="numeric" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
        </div>
        <button onClick={() => canCreate && onCreate({ name: setupName.trim(), age: Number(setupAge), avatar: setupAvatar })} disabled={!canCreate} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none", cursor: canCreate ? "pointer" : "default",
          background: canCreate ? "linear-gradient(135deg, #A78BFA, #7C3AED)" : "#E5E7EB",
          color: canCreate ? "#FFF" : "#9CA3AF",
          fontFamily: "'Fredoka',sans-serif", fontSize: 15, fontWeight: 700,
        }}>Create Account</button>
      </div>
    </div>
  );
}

function ChatRoom({ account }) {
  const [nickname, setNickname] = useState(null);
  const [avatar, setAvatar] = useState("🦄");
  const [age, setAge] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [friendNotice, setFriendNotice] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const userColor = useRef(CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)]);
  const userId = useRef(account?.userId || createUserId());

  // Load saved profile
  useEffect(() => {
    (async () => {
      try {
        const profile = await window.storage.get("chat-profile");
        if (profile?.value) {
          const p = JSON.parse(profile.value);
          setNickname(p.name);
          setAvatar(p.avatar);
          setAge(p.age || null);
          const backendFriends = await loadFriends(p.userId || userId.current);
          setFriends(mergeFriendsByName(backendFriends || p.friends || []));
          userColor.current = p.color || CHAT_COLORS[0];
          userId.current = p.userId || userId.current;
        } else if (account) {
          setNickname(account.name);
          setAvatar(account.avatar);
          setAge(account.age || null);
          const backendFriends = await loadFriends(account.userId || userId.current);
          setFriends(mergeFriendsByName(backendFriends || account.friends || []));
          userColor.current = account.color || userColor.current;
          userId.current = account.userId || userId.current;
        }
      } catch {}
      setLoading(false);
    })();
  }, [account]);

  // Save profile
  const saveProfile = async (name, av, accountAge = age, accountFriends = friends) => {
    const profile = { name, age: accountAge, avatar: av, color: userColor.current, userId: userId.current, friends: accountFriends };
    try {
      await window.storage.set("chat-profile", JSON.stringify(profile));
      await saveAccount({ id: profile.userId, userId: profile.userId, name, age: accountAge, avatar: av, color: profile.color });
      await saveFriends(profile.userId, accountFriends);
    } catch {}
    setNickname(name);
    setAvatar(av);
    setAge(accountAge);
    setFriends(accountFriends);
    window.dispatchEvent(new CustomEvent("ava-profile-created"));
  };

  const searchFriends = async () => {
    const q = normalizeAccountName(friendSearch);
    if (!q) { setFriendResults([]); return; }
    try {
      const matches = await searchAccounts(q, userId.current, friends.map(f => f.id));
      setFriendResults(matches);
      setFriendNotice(matches.length ? "" : backendMode === "supabase" ? "No matching account found." : "No matching account found on this device yet.");
    } catch {
      setFriendNotice("Search is not available right now.");
    }
  };

  const addFriend = async friend => {
    const nextFriend = { id: friend.id, name: friend.name, age: friend.age, avatar: friend.avatar, color: friend.color };
    const nextFriends = mergeFriendsByName([...friends, nextFriend]);
    await saveProfile(nickname, avatar, age, nextFriends);
    setFriendSearch("");
    setFriendResults([]);
    setFriendNotice(`${friend.name} added to friends!`);
  };

  const removeFriend = async friendId => {
    const nextFriends = friends.filter(f => f.id !== friendId);
    await saveProfile(nickname, avatar, age, nextFriends);
  };

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const backendMessages = await loadChatMessages(userId.current);
      setMessages(backendMessages);
    } catch {}
  }, []);

  // Poll for new messages
  useEffect(() => {
    if (!nickname) return;
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    // Register presence
    (async () => {
      try {
        const users = await updatePresence({ userId: userId.current, name: nickname, avatar, color: userColor.current });
        setOnlineUsers(users);
      } catch {}
    })();
    return () => clearInterval(pollRef.current);
  }, [nickname, loadMessages, avatar]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Heartbeat presence
  useEffect(() => {
    if (!nickname) return;
    const hb = setInterval(async () => {
      try {
        const users = await updatePresence({ userId: userId.current, name: nickname, avatar, color: userColor.current });
        setOnlineUsers(users);
      } catch {}
    }, 10000);
    return () => clearInterval(hb);
  }, [nickname, avatar]);

  // Send message
  const sendMessage = async (text) => {
    if (!text.trim() || sending || friends.length === 0) return;
    setSending(true);
      const msg = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      userId: userId.current,
      name: nickname,
      avatar,
      color: userColor.current,
      text: text.trim(),
      time: Date.now(),
      recipientIds: await resolveRecipientIds(friends),
    };
    try {
      await sendChatMessage(msg);
      setMessages(prev => [...prev, msg].slice(-100));
      setInput("");
    } catch { setMessages(prev => [...prev, msg]); setInput(""); }
    setSending(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  // Setup screen
  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 32, animation: "pulse 1s infinite" }}>💬</div><style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style></div>;

  if (!nickname) {
    return <AccountSetup onCreate={({ name, age: nextAge, avatar: nextAvatar }) => saveProfile(name, nextAvatar, nextAge, [])} title="Create Account" subtitle="Add your name and age to chat with friends!" />;
  }

  // Chat view
  const isMe = (msg) => msg.userId === userId.current;
  const friendIds = new Set(friends.map(f => f.id));
  const visibleMessages = messages.filter(msg => {
    const sentByFriend = friendIds.has(msg.userId);
    const sentByMe = msg.userId === userId.current;
    const recipientIds = msg.recipientIds || [];
    const sentToMe = recipientIds.includes(userId.current);
    const legacyFriendMessage = sentByFriend && recipientIds.length === 0;
    return sentByMe || sentToMe || legacyFriendMessage;
  });
  const canChat = friends.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", marginBottom: -12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 15, fontWeight: 700, color: "#1F2937" }}>💬 Chat Room</div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#9CA3AF" }}>{avatar} {nickname}{age ? `, ${age}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {onlineUsers.slice(0, 5).map((u, i) => (
            <div key={i} title={u.name} style={{ width: 24, height: 24, borderRadius: 12, background: u.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginLeft: i > 0 ? -6 : 0, border: "2px solid #FFF", position: "relative", zIndex: 5 - i }}>{u.avatar}</div>
          ))}
          <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#22C55E", fontWeight: 600 }}>
            {onlineUsers.length > 0 ? `${onlineUsers.length} online` : ""}
          </span>
        </div>
      </div>

      {/* Friends */}
      <div style={{ background: "#FFF", borderRadius: 12, padding: 8, marginBottom: 6, boxShadow: "0 1px 4px rgba(0,0,0,.03)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 700, color: "#1F2937" }}>Friends</span>
          <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#9CA3AF" }}>{friends.length}</span>
        </div>
        {friends.length > 0 && (
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6 }}>
            {friends.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 7px", borderRadius: 8, background: (f.color || "#7C3AED") + "14", flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>{f.avatar}</span>
                <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: f.color || "#7C3AED", fontWeight: 700 }}>{f.name}</span>
                <button onClick={() => removeFriend(f.id)} style={{ border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", fontSize: 10, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 5 }}>
          <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFriends()} placeholder="Search by name..." style={{ flex: 1, padding: "7px 9px", borderRadius: 9, border: "1px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 11, outline: "none" }} />
          <button onClick={searchFriends} style={{ ...BS, padding: "7px 10px", fontSize: 10, background: "linear-gradient(135deg,#A78BFA,#7C3AED)", color: "#FFF" }}>Search</button>
        </div>
        {friendNotice && <div style={{ marginTop: 5, fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#059669" }}>{friendNotice}</div>}
        {friendResults.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
            {friendResults.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 9, background: "#F9FAFB" }}>
                <span style={{ fontSize: 16 }}>{f.avatar}</span>
                <span style={{ flex: 1, fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#1F2937" }}>{f.name}{f.age ? `, ${f.age}` : ""}</span>
                <button onClick={() => addFriend(f)} style={{ ...BS, padding: "5px 9px", fontSize: 10, background: "#ECFDF5", color: "#059669" }}>Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Online users bar */}
      {onlineUsers.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, flexShrink: 0 }}>
          {onlineUsers.filter(u => u.id !== userId.current).map((u, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: u.color + "15", borderRadius: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 13 }}>{u.avatar}</span>
              <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: u.color, fontWeight: 600 }}>{u.name}</span>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#22C55E" }} />
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleMessages.length === 0 && (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ fontSize: 36 }}>👋</div>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 15, color: "#9CA3AF", marginTop: 6 }}>{friends.length ? "No messages yet!" : "Add a friend to start chatting!"}</div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 12, color: "#D1D5DB", marginTop: 2 }}>{friends.length ? "Send the first message to your friends 💬" : "Search for another account by name."}</div>
          </div>
        )}
        {visibleMessages.map((msg, i) => {
          const me = isMe(msg);
          const showAvatar = i === 0 || visibleMessages[i - 1].userId !== msg.userId;
          return (
            <div key={msg.id || i}>
              {showAvatar && !me && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, marginTop: i > 0 ? 4 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: msg.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{msg.avatar}</div>
                  <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: msg.color, fontWeight: 600 }}>{msg.name}</span>
                  <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#D1D5DB" }}>{formatTime(msg.time)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", paddingLeft: me ? 40 : (showAvatar ? 27 : 27), paddingRight: me ? 0 : 40 }}>
                <div style={{
                  maxWidth: "80%", padding: msg.text.length <= 2 ? "8px 10px" : "8px 14px",
                  borderRadius: 16,
                  borderBottomRightRadius: me ? 4 : 16,
                  borderBottomLeftRadius: me ? 16 : 4,
                  background: me ? `linear-gradient(135deg, ${userColor.current}, ${userColor.current}CC)` : "#FFF",
                  color: me ? "#FFF" : "#1F2937",
                  fontFamily: "'Nunito',sans-serif",
                  fontSize: msg.text.length <= 2 ? 24 : 13,
                  lineHeight: 1.5,
                  boxShadow: me ? `0 2px 6px ${userColor.current}30` : "0 1px 3px rgba(0,0,0,.04)",
                  wordBreak: "break-word",
                }}>{msg.text}</div>
              </div>
              {me && showAvatar && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 1 }}>
                  <span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#D1D5DB" }}>{formatTime(msg.time)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticker bar */}
      <div style={{ display: "flex", gap: 3, padding: "4px 0", overflowX: "auto", flexShrink: 0 }}>
        {CHAT_STICKERS.map((s, i) => (
          <button key={i} onClick={() => sendMessage(s)} disabled={!canChat} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFF",
            fontSize: 15, cursor: canChat ? "pointer" : "default", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: canChat ? 1 : .45,
          }}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 6, padding: "6px 0", flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: userColor.current + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{avatar}</div>
        <input
          value={input} onChange={e => setInput(e.target.value.slice(0, 200))}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder={canChat ? "Type a message..." : "Add a friend first..."}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 12, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending || !canChat} style={{
          padding: "8px 14px", borderRadius: 12, border: "none", cursor: input.trim() && canChat ? "pointer" : "default",
          background: input.trim() && canChat ? `linear-gradient(135deg, ${userColor.current}, ${userColor.current}CC)` : "#E5E7EB",
          color: input.trim() && canChat ? "#FFF" : "#9CA3AF",
          fontFamily: "'Fredoka',sans-serif", fontSize: 13, fontWeight: 600, flexShrink: 0,
        }}>Send</button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AvasWorld() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);
  const [completedTasks, setCompletedTasks] = useState({});
  const [totalStars, setTotalStars] = useState(0);
  const [showStarAnim, setShowStarAnim] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedGameTheme, setSelectedGameTheme] = useState("🌸 Cherry Blossom");
  const [unlockedItems, setUnlockedItems] = useState({});
  const [expandedNews, setExpandedNews] = useState(null);
  const [charIndex, setCharIndex] = useState(0);
  const [newsStories, setNewsStories] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [dayStreak] = useState(5);
  const [showChat, setShowChat] = useState(false);
  const [loveLog, setLoveLog] = useState(INITIAL_LOVE_LOG);
  const [diaryEntries, setDiaryEntries] = useState([{id:1,date:"2026-02-07",text:"Learned Chinese character for 'love'! 💕",mood:"😊",images:[],tags:["chinese"]},{id:2,date:"2026-02-06",text:"Octopuses have 3 hearts!",mood:"🤩",images:[],tags:["science"]}]);
  const [diarySearch, setDiarySearch] = useState("");
  const [diaryWriting, setDiaryWriting] = useState(false);
  const [diaryText, setDiaryText] = useState("");
  const [diaryMood, setDiaryMood] = useState("😊");
  const [diaryImages, setDiaryImages] = useState([]);
  const [diaryViewEntry, setDiaryViewEntry] = useState(null);
  const [diaryConfirmDelete, setDiaryConfirmDelete] = useState(null);
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [editingReward, setEditingReward] = useState(null);
  const [rewardEditMode, setRewardEditMode] = useState(false);
  const [confirmDeleteReward, setConfirmDeleteReward] = useState(null);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardStars, setNewRewardStars] = useState("");
  const [newRewardEmoji, setNewRewardEmoji] = useState("🎁");
  const [showAddReward, setShowAddReward] = useState(false);
  const [studySubTab, setStudySubTab] = useState("math");
  const [moreSubTab, setMoreSubTab] = useState("games");
  const addStars = useCallback(n => { setTotalStars(s => s + n); setShowStarAnim(n); }, []);
  const handleMemoryWin = useCallback(() => addStars(15), [addStars]);
  const handleMathScore = useCallback(n => addStars(n), [addStars]);
  const handleRiddleScore = useCallback(n => addStars(n), [addStars]);
  const [claimedRewards, setClaimedRewards] = useState({});
  const [songs, setSongs] = useState(DEFAULT_SONGS);
  const [songSearch, setSongSearch] = useState("");
  const [showAddSong, setShowAddSong] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [newSongMood, setNewSongMood] = useState("🎵 Fun");
  const [playingSongIdx, setPlayingSongIdx] = useState(null);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineResults, setOnlineResults] = useState([]);
  const [loadingVideo, setLoadingVideo] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [account, setAccount] = useState(null);

  // ─── LOAD SAVED DATA ON MOUNT ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const profile = await window.storage.get("chat-profile");
        const accountExists = Boolean(profile?.value);
        setHasAccount(accountExists);
        if (accountExists) {
          const savedProfile = JSON.parse(profile.value);
          setAccount(savedProfile);
          if (savedProfile.name && savedProfile.userId) {
            await saveAccount({ id: savedProfile.userId, userId: savedProfile.userId, name: savedProfile.name, age: savedProfile.age, avatar: savedProfile.avatar, color: savedProfile.color });
          }
        }
        if (accountExists) {
          const result = await window.storage.get("ava-world-data");
          if (result && result.value) {
            const d = JSON.parse(result.value);
            if (d.totalStars !== undefined) setTotalStars(d.totalStars);
            if (d.completedTasks) setCompletedTasks(d.completedTasks);
            if (d.unlockedItems) setUnlockedItems(d.unlockedItems);
            if (d.loveLog) setLoveLog(d.loveLog);
            if (d.diaryEntries) setDiaryEntries(d.diaryEntries);
            if (d.rewards) setRewards(d.rewards);
            if (d.claimedRewards) setClaimedRewards(d.claimedRewards);
            if (d.songs) setSongs(d.songs);
            if (d.charIndex !== undefined) setCharIndex(d.charIndex);
          }
        }
      } catch (e) {
        // First time or storage unavailable — use defaults
      }
      setDataLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    const handleProfileCreated = async () => {
      try {
        const profile = await window.storage.get("chat-profile");
        if (profile?.value) setAccount(JSON.parse(profile.value));
      } catch {}
      setHasAccount(true);
    };
    window.addEventListener("ava-profile-created", handleProfileCreated);
    return () => window.removeEventListener("ava-profile-created", handleProfileCreated);
  }, []);

  const createAccount = async ({ name, age, avatar }) => {
    const profile = {
      name,
      age,
      avatar,
      color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)],
      userId: createUserId(),
      friends: [],
    };
    try {
      await window.storage.set("chat-profile", JSON.stringify(profile));
      await saveAccount({ id: profile.userId, userId: profile.userId, name, age, avatar, color: profile.color });
      await saveFriends(profile.userId, []);
    } catch {}
    setAccount(profile);
    setHasAccount(true);
    window.dispatchEvent(new CustomEvent("ava-profile-created"));
  };

  // ─── AUTO-SAVE WHEN DATA CHANGES ──────────────────────────────────
  useEffect(() => {
    if (!dataLoaded || !hasAccount) return;
    const save = async () => {
      try {
        await window.storage.set("ava-world-data", JSON.stringify({
          totalStars, completedTasks, unlockedItems, loveLog,
          diaryEntries, rewards, claimedRewards, songs, charIndex
        }));
      } catch (e) { /* storage unavailable */ }
    };
    save();
  }, [dataLoaded, hasAccount, totalStars, completedTasks, unlockedItems, loveLog, diaryEntries, rewards, claimedRewards, songs, charIndex]);

  const now = new Date();
  const greetingTime = now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const todaySchedule = STUDY_SCHEDULE[selectedDay] || [];
  const todayKey = DAYS[now.getDay()];
  const todayTasks = STUDY_SCHEDULE[todayKey] || [];
  const todayCompleted = Object.keys(completedTasks).filter(k => k.startsWith(todayKey) && completedTasks[k]).length;
  const motivMsg = MOTIVATIONAL_MSGS[now.getDate() % MOTIVATIONAL_MSGS.length];
  const todayDateKey = makeDateKey(now);
  const todayLove = loveLog[todayDateKey] || { kisses: 0, loveyous: 0 };
  const accountInitial = (account?.name || "A").trim().charAt(0).toUpperCase() || "A";

  const spendStars = cost => { if (totalStars >= cost) { setTotalStars(s => s - cost); return true; } return false; };
  const toggleTask = (day, idx) => { const key = `${day}-${idx}`; const was = completedTasks[key]; setCompletedTasks(p => ({ ...p, [key]: !p[key] })); if (!was) { const t = STUDY_SCHEDULE[day]?.[idx]; if (t) addStars(t.stars); } };
  const unlockItem = (type, index, cost) => { if (spendStars(cost)) { setUnlockedItems(p => ({ ...p, [`${type}-${index}`]: true })); return true; } return false; };
  const handleKiss = useCallback(() => { setLoveLog(prev => { const key = makeDateKey(new Date()); const cur = prev[key] || { kisses: 0, loveyous: 0 }; return { ...prev, [key]: { ...cur, kisses: cur.kisses + 1 } }; }); }, []);
  const handleLoveYou = useCallback(() => { setLoveLog(prev => { const key = makeDateKey(new Date()); const cur = prev[key] || { kisses: 0, loveyous: 0 }; return { ...prev, [key]: { ...cur, loveyous: cur.loveyous + 1 } }; }); }, []);
  const handleDiaryImage = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setDiaryImages(p => [...p, ev.target.result]); r.readAsDataURL(f); };
  const saveDiary = () => { if (!diaryText.trim()) return; setDiaryEntries(p => [{ id: Date.now(), date: now.toISOString().split("T")[0], text: diaryText, mood: diaryMood, images: diaryImages, tags: diaryText.toLowerCase().match(/#(\w+)/g)?.map(t => t.slice(1)) || [] }, ...p]); setDiaryText(""); setDiaryMood("😊"); setDiaryImages([]); setDiaryWriting(false); addStars(3); };

  const fetchNews = async () => {
    setNewsLoading(true); setNewsError(null);
    try { const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: `News reporter for 8-year-old Ava. Search today's news, create 4 kid stories. ONLY JSON: [{"title":"...","emoji":"🐸","summary":"...","category":"Science"}]` }] }) }); const data = await res.json(); const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || ""; const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); const colors = ["#34D399", "#60A5FA", "#F472B6", "#FBBF24"]; setNewsStories(parsed.map((s, i) => ({ ...s, color: colors[i % 4] }))); } catch { setNewsError("Fun facts instead!"); setNewsStories([{ title: "Honey Never Spoils!", emoji: "🍯", summary: "3,000-year-old honey was still edible!", category: "Fun Facts", color: "#FBBF24" }, { title: "Octopuses Have Blue Blood", emoji: "🐙", summary: "Copper in their blood makes it blue!", category: "Animals", color: "#60A5FA" }, { title: "Venus Days > Years", emoji: "🪐", summary: "One Venus day = 243 Earth days!", category: "Space", color: "#F472B6" }, { title: "Bananas Are Berries!", emoji: "🍌", summary: "Botanically berries, strawberries aren't!", category: "Science", color: "#34D399" }]); }
    setNewsLoading(false);
  };
  useEffect(() => { if (activeTab === 6 && moreSubTab === "news" && newsStories.length === 0 && !newsLoading) fetchNews(); }, [activeTab, moreSubTab]);

  // ─── HOME ─────────────────────────────────────────────────────────────
  const HomeTab = () => {
    const starsNeeded = rewards.filter(r => r.stars > totalStars).sort((a, b) => a.stars - b.stars)[0];
    return (<div>
      <div style={S.heroCard}><div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontFamily: "'Fredoka',sans-serif" }}>{MONTHS[now.getMonth()]} {now.getDate()}, {now.getFullYear()}</div><div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#FFF", margin: "3px 0" }}>{greetingTime}, Ava! ✨</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{motivMsg}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>{[{ l: "Stars", v: `${totalStars}⭐`, bg: "linear-gradient(135deg,#FFF7ED,#FFEDD5)" }, { l: "Streak", v: `${dayStreak}🔥`, bg: "linear-gradient(135deg,#FFF1F2,#FFE4E6)" }, { l: "Today", v: `${todayCompleted}/${todayTasks.length}`, bg: "linear-gradient(135deg,#F0FDF4,#DCFCE7)" }, { l: "Love", v: `${todayLove.kisses + todayLove.loveyous}💕`, bg: "linear-gradient(135deg,#FDF2F8,#FCE7F3)" }].map((s, i) => <div key={i} style={{ ...S.statCard, background: s.bg }}><div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#1F2937" }}>{s.v}</div><div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'Nunito',sans-serif" }}>{s.l}</div></div>)}</div>
      <div style={{ ...S.sectionHeader, marginBottom: 6 }}><span>🚀 Missions</span><span style={{ fontSize: 10, color: "#A78BFA", fontFamily: "'Nunito',sans-serif" }}>+{todayTasks.reduce((a, t) => a + t.stars, 0)}⭐</span></div>
      {todayCompleted < todayTasks.length ? <div style={{ padding: 10, background: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", borderRadius: 12, marginBottom: 10 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#5B21B6", marginBottom: 5 }}>{todayCompleted === 0 ? "💪 Let's earn stars!" : `🎯 ${todayTasks.length - todayCompleted} to go!`}</div>{todayTasks.map((task, i) => { const done = completedTasks[`${todayKey}-${i}`]; return <div key={i} onClick={() => toggleTask(todayKey, i)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: done ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.3)", borderRadius: 8, marginBottom: 3, cursor: "pointer" }}><div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${done ? "#34D399" : "#A78BFA"}`, background: done ? "#34D399" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 9 }}>{done ? "✓" : ""}</div><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: done ? "#6B7280" : "#1F2937", textDecoration: done ? "line-through" : "none", flex: 1 }}>{task.icon} {task.subject}</span><span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#FBBF24" }}>+{task.stars}⭐</span></div>; })}</div> : <div style={{ padding: 12, background: "linear-gradient(135deg,#D1FAE5,#A7F3D0)", borderRadius: 12, marginBottom: 10, textAlign: "center" }}><div style={{ fontSize: 28 }}>🎉</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 14, color: "#065F46", fontWeight: 600 }}>All done!</div></div>}
      {/* Quick links row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div onClick={() => { setActiveTab(5); setMoreSubTab("love"); }} style={{ cursor: "pointer", padding: 10, background: "linear-gradient(135deg,#FDF2F8,#FCE7F3)", borderRadius: 11, textAlign: "center" }}><div style={{ fontSize: 20 }}>💕</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 9, color: "#9D174D", fontWeight: 600 }}>💋{todayLove.kisses} ❤️{todayLove.loveyous}</div></div>
        <div onClick={() => { setActiveTab(1); setStudySubTab("stem"); }} style={{ cursor: "pointer", padding: 10, background: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", borderRadius: 11, textAlign: "center" }}><div style={{ fontSize: 20 }}>🔬</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 9, color: "#5B21B6", fontWeight: 600 }}>STEM Lab</div></div>
        <div onClick={() => setActiveTab(2)} style={{ cursor: "pointer", padding: 10, background: "linear-gradient(135deg,#FCE7F3,#FBCFE8)", borderRadius: 11, textAlign: "center" }}><div style={{ fontSize: 20 }}>📓</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 9, color: "#9D174D", fontWeight: 600 }}>Diary +3⭐</div></div>
        <div onClick={() => setActiveTab(3)} style={{ cursor: "pointer", padding: 10, background: "linear-gradient(135deg,#DBEAFE,#BFDBFE)", borderRadius: 11, textAlign: "center" }}><div style={{ fontSize: 20 }}>💬</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 9, color: "#1D4ED8", fontWeight: 600 }}>Chat Room</div></div>
      </div>
      {starsNeeded && <div style={{ padding: 10, background: "linear-gradient(135deg,#FFF7ED,#FFEDD5)", borderRadius: 11, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 22 }}>{starsNeeded.emoji}</div><div style={{ flex: 1 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, fontWeight: 600, color: "#92400E" }}>Next: {starsNeeded.name}</div><div style={{ height: 5, borderRadius: 3, background: "#FDE68A", marginTop: 3, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#FBBF24,#F59E0B)", width: `${Math.min(100, (totalStars / starsNeeded.stars) * 100)}%` }} /></div></div></div>}
    </div>);
  };

  // ─── STUDY ────────────────────────────────────────────────────────────
  const StudyTab = () => (<div><div style={S.sectionHeader}><span>📚 Study</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#FBBF24" }}>⭐{totalStars}</span></div><div style={{ display: "flex", gap: 4, marginBottom: 12 }}>{DAYS.map(d => <button key={d} onClick={() => setSelectedDay(d)} style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, background: selectedDay === d ? "linear-gradient(135deg,#A78BFA,#7C3AED)" : "#F3F4F6", color: selectedDay === d ? "#FFF" : "#6B7280" }}>{d}</button>)}</div>{todaySchedule.length === 0 ? <div style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 36 }}>🌸</div><div style={{ fontFamily: "'Fredoka',sans-serif", color: "#9CA3AF" }}>Light day!</div></div> : todaySchedule.map((task, i) => { const key = `${selectedDay}-${i}`; const done = completedTasks[key]; return <div key={i} onClick={() => toggleTask(selectedDay, i)} style={{ padding: "10px 12px", borderRadius: 12, marginBottom: 6, cursor: "pointer", background: done ? "linear-gradient(135deg,#D1FAE5,#A7F3D0)" : "#FFF", borderLeft: `4px solid ${task.color}`, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 36, height: 36, borderRadius: 9, background: `${task.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{task.icon}</div><div><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: 13, color: "#1F2937", textDecoration: done ? "line-through" : "none" }}>{task.subject}</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#9CA3AF" }}>{task.time} · <span style={{ color: "#FBBF24" }}>+{task.stars}⭐</span></div></div></div><div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${done ? "#34D399" : "#D1D5DB"}`, background: done ? "#34D399" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 11 }}>{done ? "✓" : ""}</div></div></div>; })}</div>);

  // ─── DIARY ────────────────────────────────────────────────────────────
  const deleteDiaryEntry = (id) => { setDiaryEntries(p => p.filter(e => e.id !== id)); setDiaryViewEntry(null); setDiaryConfirmDelete(null); };
  const DiaryTab = () => { const filtered = diaryEntries.filter(e => { if (!diarySearch.trim()) return true; const q = diarySearch.toLowerCase(); return e.text.toLowerCase().includes(q) || e.tags.some(t => t.includes(q)) || e.date.includes(q); }); if (diaryViewEntry) { const entry = diaryViewEntry; return <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><button onClick={() => { setDiaryViewEntry(null); setDiaryConfirmDelete(null); }} style={S.backBtn}>← Back</button><button onClick={() => setDiaryConfirmDelete(diaryConfirmDelete === entry.id ? null : entry.id)} style={{ ...BS, background: "#FEF2F2", color: "#EF4444", fontSize: 11 }}>🗑️ Delete</button></div>{diaryConfirmDelete === entry.id && (<div style={{ margin: "8px 0", padding: 12, background: "#FEF2F2", borderRadius: 12, border: "2px solid #FECACA" }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 8 }}>Delete this diary entry?</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#6B7280", marginBottom: 10 }}>This can't be undone!</div><div style={{ display: "flex", gap: 8 }}><button onClick={() => setDiaryConfirmDelete(null)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "2px solid #E5E7EB", background: "#FFF", fontFamily: "'Fredoka',sans-serif", fontSize: 12, color: "#6B7280", cursor: "pointer" }}>Cancel</button><button onClick={() => deleteDiaryEntry(entry.id)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#EF4444,#DC2626)", fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#FFF", cursor: "pointer" }}>🗑️ Yes, Delete</button></div></div>)}<div style={{ marginTop: 6, background: "#FFF", borderRadius: 14, padding: 14, boxShadow: "0 2px 6px rgba(0,0,0,.04)" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#6B7280" }}>{entry.date}</span><span style={{ fontSize: 22 }}>{entry.mood}</span></div>{entry.images.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>{entry.images.map((img, i) => <img key={i} src={img} alt="" style={{ width: 140, height: 105, objectFit: "cover", borderRadius: 10 }} />)}</div>}<div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 14, color: "#1F2937", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.text}</div></div></div>; }
    if (diaryWriting) return <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><button onClick={() => setDiaryWriting(false)} style={S.backBtn}>← Back</button><button onClick={saveDiary} disabled={!diaryText.trim()} style={{ ...BS, background: diaryText.trim() ? "linear-gradient(135deg,#F472B6,#EC4899)" : "#E5E7EB", color: diaryText.trim() ? "#FFF" : "#9CA3AF" }}>Save +3⭐</button></div><div style={{ background: "#FFF", borderRadius: 14, padding: 14 }}><div style={{ display: "flex", gap: 7, marginBottom: 10 }}>{["😊","🤩","😌","🤔","😢","😤"].map(m => <button key={m} onClick={() => setDiaryMood(m)} style={{ fontSize: 22, padding: 3, borderRadius: 7, border: diaryMood === m ? "2px solid #F472B6" : "2px solid transparent", background: diaryMood === m ? "#FCE7F3" : "transparent", cursor: "pointer" }}>{m}</button>)}</div><textarea value={diaryText} onChange={e => setDiaryText(e.target.value)} placeholder="Write about your day! Use #tags" style={{ width: "100%", minHeight: 180, padding: 10, borderRadius: 10, border: "2px solid #F3E8FF", fontFamily: "'Nunito',sans-serif", fontSize: 13, resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box", WebkitOverflowScrolling: "touch" }} /><div style={{ marginTop: 8 }}><label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "#F3F4F6", cursor: "pointer", fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: "#6B7280" }}>📷 Photo<input type="file" accept="image/*" onChange={handleDiaryImage} style={{ display: "none" }} /></label>{diaryImages.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 6 }}>{diaryImages.map((img, i) => <div key={i} style={{ position: "relative" }}><img src={img} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} /><button onClick={() => setDiaryImages(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, border: "none", background: "#FF6B6B", color: "#FFF", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button></div>)}</div>}</div></div></div>;
    return <div><div style={S.sectionHeader}><span>📓 Diary</span></div><div style={{ display: "flex", gap: 7, marginBottom: 12 }}><div style={{ flex: 1, position: "relative" }}><input value={diarySearch} onChange={e => setDiarySearch(e.target.value)} placeholder="Search..." style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 9, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 12, outline: "none", boxSizing: "border-box" }} /><span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}>🔍</span></div><button onClick={() => setDiaryWriting(true)} style={{ ...BS, background: "linear-gradient(135deg,#F472B6,#EC4899)", color: "#FFF" }}>✏️</button></div>{filtered.length === 0 ? <div style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 36 }}>📓</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>No entries yet!</div></div> : filtered.map(entry => <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><div onClick={() => setDiaryViewEntry(entry)} style={{ flex: 1, padding: 10, background: "#FFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,.02)", cursor: "pointer", borderLeft: "3px solid #F472B6" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#9CA3AF" }}>{entry.date}</span><span style={{ fontSize: 14 }}>{entry.mood}</span></div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 12, color: "#1F2937", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{entry.text}</div></div><button onClick={(e) => { e.stopPropagation(); deleteDiaryEntry(entry.id); }} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: "none", background: "#FEF2F2", color: "#EF4444", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button></div>)}</div>;
  };

  // ─── MUSIC ────────────────────────────────────────────────────────────
  const [searchError, setSearchError] = useState("");

  const searchOnlineSongs = () => {
    if (!onlineQuery.trim()) return;
    setSearchingOnline(true);
    setOnlineResults([]);
    setSearchError("");
    const q = onlineQuery.toLowerCase();
    // Search against local song database
    const matches = POPULAR_KIDS_SONGS.filter(s => {
      const hay = `${s.title} ${s.artist} ${s.tags || ""}`.toLowerCase();
      return q.split(/\s+/).some(word => hay.includes(word));
    }).slice(0, 8);
    // Exclude songs already in playlist
    const existing = new Set(songs.map(s => s.ytId));
    const filtered = matches.filter(s => !existing.has(s.ytId));
    if (filtered.length > 0) {
      setOnlineResults(filtered);
    } else if (matches.length > 0) {
      setSearchError("Those songs are already in your playlist!");
    } else {
      setSearchError("No matches found. Try: Taylor, Disney, dance, happy...");
    }
    setSearchingOnline(false);
  };

  const openSongOnYouTube = (song) => {
    if (song.ytId) {
      window.open(`https://www.youtube.com/watch?v=${song.ytId}`, "_blank");
    } else {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + " " + song.artist + " official")}`, "_blank");
    }
  };

  const MusicTab = () => {
    const filtered = songs.filter(s => {
      if (!songSearch.trim()) return true;
      const q = songSearch.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.mood.toLowerCase().includes(q);
    });
    const gradients = ["#FF6B6B","#A78BFA","#4ECDC4","#FFE66D","#F472B6","#60A5FA","#34D399","#FBBF24","#E879F9","#FB923C"];

    return <div>
      <div style={S.sectionHeader}><span>🎵 My Playlist ({songs.length})</span></div>

      {/* Search & Add */}
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Filter playlist..." style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 9, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}>🔍</span>
        </div>
        <button onClick={() => { setShowAddSong(!showAddSong); setSearchError(""); setOnlineResults([]); }} style={{ ...BS, background: showAddSong ? "#F3F4F6" : "linear-gradient(135deg,#A78BFA,#7C3AED)", color: showAddSong ? "#6B7280" : "#FFF" }}>{showAddSong ? "✕" : "＋"}</button>
      </div>

      {/* Add Song Panel */}
      {showAddSong && <div style={{ padding: 10, background: "#FFF", borderRadius: 12, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
        {/* Online Search */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#5B21B6", marginBottom: 5 }}>🌐 Search for Songs</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={onlineQuery} onChange={e => setOnlineQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchOnlineSongs()} placeholder="e.g. Taylor Swift, Disney, fun dance..." style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            <button onClick={searchOnlineSongs} disabled={searchingOnline || !onlineQuery.trim()} style={{ ...BS, padding: "6px 12px", fontSize: 11, background: onlineQuery.trim() && !searchingOnline ? "linear-gradient(135deg,#60A5FA,#3B82F6)" : "#E5E7EB", color: onlineQuery.trim() && !searchingOnline ? "#FFF" : "#9CA3AF" }}>{searchingOnline ? "..." : "Search"}</button>
          </div>
          {searchingOnline && <div style={{ textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 22, animation: "pulse 1s infinite" }}>🔍</div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#7C3AED", marginTop: 4 }}>Searching for songs...</div>
            <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style>
          </div>}
          {searchError && <div style={{ marginTop: 6, padding: "6px 10px", background: "#FEF2F2", borderRadius: 7, fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#991B1B" }}>{searchError}</div>}
          {onlineResults.length > 0 && <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#9CA3AF", marginBottom: 4 }}>{onlineResults.length} results found — tap + to add</div>
            {onlineResults.map((r, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", background: "#F9FAFB", borderRadius: 8, marginBottom: 4 }}>
              <a href={`https://www.youtube.com/watch?v=${r.ytId}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 16, textDecoration: "none", flexShrink: 0 }}>▶️</a>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#9CA3AF" }}>{r.artist || "Unknown"}</div>
              </div>
              <button onClick={() => { setSongs(p => [...p, { title: r.title, artist: r.artist || "Unknown", mood: "🎵 Fun", ytId: r.ytId }]); setOnlineResults(p => p.filter((_, j) => j !== i)); }} style={{ ...BS, padding: "4px 10px", fontSize: 10, background: "linear-gradient(135deg,#34D399,#059669)", color: "#FFF", flexShrink: 0 }}>+ Add</button>
            </div>)}
          </div>}
        </div>

        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 8 }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>✏️ Or Add Manually</div>
          <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="Song title *" style={{ width: "100%", padding: "6px 9px", borderRadius: 7, border: "1px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 11, outline: "none", marginBottom: 4, boxSizing: "border-box" }} />
          <input value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} placeholder="Artist" style={{ width: "100%", padding: "6px 9px", borderRadius: 7, border: "1px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 11, outline: "none", marginBottom: 4, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 3, marginBottom: 5, flexWrap: "wrap" }}>{["🎉 Upbeat","😊 Happy","❄️ Magical","🎵 Fun","😌 Chill"].map(m => <button key={m} onClick={() => setNewSongMood(m)} style={{ padding: "2px 6px", borderRadius: 4, border: newSongMood === m ? "2px solid #A78BFA" : "1px solid #E5E7EB", background: newSongMood === m ? "#EDE9FE" : "#FFF", fontFamily: "'Nunito',sans-serif", fontSize: 9, cursor: "pointer" }}>{m}</button>)}</div>
          <button onClick={() => { if (!newSongTitle.trim()) return; setSongs(p => [...p, { title: newSongTitle, artist: newSongArtist || "Unknown", mood: newSongMood }]); setNewSongTitle(""); setNewSongArtist(""); setShowAddSong(false); }} disabled={!newSongTitle.trim()} style={{ ...BS, width: "100%", padding: "7px", background: newSongTitle.trim() ? "linear-gradient(135deg,#A78BFA,#7C3AED)" : "#E5E7EB", color: newSongTitle.trim() ? "#FFF" : "#9CA3AF" }}>Add to Playlist</button>
        </div>
      </div>}

      {/* Song List */}
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 32 }}>🎵</div>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>{songSearch ? "No matches" : "No songs yet!"}</div>
      </div>}
      {filtered.map((song, i) => {
        const origIdx = songs.indexOf(song);
        return <div key={origIdx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#FFF", borderRadius: 10, marginBottom: 4, boxShadow: "0 1px 2px rgba(0,0,0,.02)" }}>
          {/* Play button - opens YouTube */}
          <button onClick={() => openSongOnYouTube(song)} style={{ width: 36, height: 36, borderRadius: 9, border: "none", cursor: "pointer", background: song.ytId ? "linear-gradient(135deg,#EF4444,#DC2626)" : "linear-gradient(135deg,#A78BFA,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#FFF", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,.1)" }}>▶</button>
          {/* Song info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: 12, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#9CA3AF" }}>{song.artist}</div>
          </div>
          {/* Mood tag & delete */}
          <span style={{ fontSize: 9, fontFamily: "'Nunito',sans-serif", padding: "2px 6px", background: "#F3F4F6", borderRadius: 4, color: "#6B7280", flexShrink: 0 }}>{song.mood}</span>
          <button onClick={e => { e.stopPropagation(); setSongs(p => p.filter((_, j) => j !== origIdx)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#D1D5DB", flexShrink: 0 }}>✕</button>
        </div>;
      })}
    </div>;
  };

  // ─── NEWS ─────────────────────────────────────────────────────────────
  const NewsTab = () => <div><div style={S.sectionHeader}><span>📰 News</span><button onClick={fetchNews} disabled={newsLoading} style={{ ...BS, fontSize: 10, padding: "3px 9px", background: newsLoading ? "#E5E7EB" : "linear-gradient(135deg,#60A5FA,#3B82F6)", color: newsLoading ? "#9CA3AF" : "#FFF" }}>{newsLoading ? "..." : "🔄"}</button></div>{newsLoading && <div style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 32, animation: "pulse 1s infinite" }}>🤖</div><style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style></div>}{newsStories.map((item, i) => <div key={i} onClick={() => setExpandedNews(expandedNews === i ? null : i)} style={{ padding: 10, marginBottom: 6, borderRadius: 12, background: "#FFF", boxShadow: "0 1px 2px rgba(0,0,0,.02)", cursor: "pointer", borderLeft: `3px solid ${item.color}` }}><div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}><div style={{ fontSize: 24, flexShrink: 0 }}>{item.emoji}</div><div style={{ flex: 1 }}><span style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: item.color, fontWeight: 700, textTransform: "uppercase" }}>{item.category}</span><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: 12, color: "#1F2937" }}>{item.title}</div></div></div>{expandedNews === i && <div style={{ marginTop: 7, padding: 8, background: "#F9FAFB", borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontSize: 12, lineHeight: 1.5, color: "#4B5563" }}>{item.summary}</div>}</div>)}</div>;

  // ─── CHINESE ──────────────────────────────────────────────────────────
  const ChineseTab = () => { const ch = CHINESE_CHARS[charIndex]; return <div><div style={S.sectionHeader}><span>🀄 Chinese Characters</span></div><div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>{CHINESE_CHARS.map((c, i) => <button key={i} onClick={() => setCharIndex(i)} style={{ minWidth: 38, height: 38, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 18, fontFamily: "'Noto Sans SC',sans-serif", background: charIndex === i ? "linear-gradient(135deg,#FBBF24,#F59E0B)" : "#FFF7ED", color: charIndex === i ? "#FFF" : "#92400E", flexShrink: 0 }}>{c.char}</button>)}</div><div style={{ background: "#FFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,.04)", marginBottom: 12 }}><div style={{ textAlign: "center", marginBottom: 12 }}><div style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 60, lineHeight: 1, color: "#1F2937" }}>{ch.char}</div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 18, color: "#A78BFA", fontWeight: 600, marginTop: 2 }}>{ch.pinyin}</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 14, color: "#6B7280" }}>{ch.meaning}</div></div><CharacterPractice key={charIndex} char={ch.char} strokeCount={ch.strokeCount} strokeNames={ch.strokeNames} /><div style={{ padding: 8, background: "#F0FDF4", borderRadius: 9, marginTop: 10, marginBottom: 6 }}><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 12, color: "#047857" }}>{ch.sentence}</div></div><div style={{ padding: 8, background: "#FFF7ED", borderRadius: 9 }}><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#A16207" }}>💡 {ch.funFact}</div></div></div><div style={{ display: "flex", justifyContent: "space-between" }}><button onClick={() => setCharIndex(p => (p - 1 + CHINESE_CHARS.length) % CHINESE_CHARS.length)} style={{ ...BS, background: "#F3F4F6", color: "#6B7280" }}>← Prev</button><button onClick={() => setCharIndex(p => (p + 1) % CHINESE_CHARS.length)} style={{ ...BS, background: "linear-gradient(135deg,#FBBF24,#F59E0B)", color: "#FFF" }}>Next →</button></div></div>; };

  // ─── GAMES ────────────────────────────────────────────────────────────
  // ─── REWARD TAB (standalone) ────────────────────────────────────────
  const claimReward = i => { if (totalStars >= rewards[i].stars && !claimedRewards[i]) { setTotalStars(s => s - rewards[i].stars); setClaimedRewards(p => ({ ...p, [i]: true })); } };
  const RewardTab = () => {
    return <div>
      <div style={S.sectionHeader}><span>🏆 Rewards</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#FBBF24" }}>⭐{totalStars}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, fontWeight: 600, color: "#1F2937" }}>🎁 My Rewards</span>
        <button onClick={() => { setRewardEditMode(!rewardEditMode); setEditingReward(null); setConfirmDeleteReward(null); }} style={{ ...BS, padding: "3px 9px", fontSize: 10, background: rewardEditMode ? "linear-gradient(135deg,#34D399,#059669)" : "#F3F4F6", color: rewardEditMode ? "#FFF" : "#6B7280" }}>{rewardEditMode ? "✓ Done" : "✏️ Edit"}</button>
      </div>
      <div style={{ background: "#FFF", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.03)", marginBottom: 10 }}>{rewards.map((r, i) => { const can = totalStars >= r.stars && !claimedRewards[i]; const claimed = claimedRewards[i]; return <div key={i}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 10px", borderTop: i > 0 ? "1px solid #F3F4F6" : "none", background: claimed ? "#F0FDF4" : confirmDeleteReward === i ? "#FEF2F2" : "#FFF" }}>
          {rewardEditMode ? <button onClick={() => { const emojis = ["🎁","🍕","🍦","🎬","📚","🎡","🧸","🍰","🎮","⚽","🎨","🎤","🏖️","🛍️","🎪"]; const idx = emojis.indexOf(r.emoji); const next = emojis[(idx + 1) % emojis.length]; const n = [...rewards]; n[i] = { ...n[i], emoji: next }; setRewards(n); }} style={{ fontSize: 18, background: "#F9FAFB", border: "2px dashed #D1D5DB", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{r.emoji}</button> : <span style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</span>}
          {editingReward === i ? <input value={r.name} onChange={e => { const n = [...rewards]; n[i] = { ...n[i], name: e.target.value }; setRewards(n); }} onBlur={() => setEditingReward(null)} onKeyDown={e => e.key === "Enter" && setEditingReward(null)} autoFocus style={{ flex: 1, padding: "4px 6px", borderRadius: 6, border: "2px solid #A78BFA", fontFamily: "'Nunito',sans-serif", fontSize: 12, outline: "none", background: "#FAFAFE" }} /> : <span onClick={() => rewardEditMode && setEditingReward(i)} style={{ flex: 1, fontFamily: "'Nunito',sans-serif", fontSize: 12, color: claimed ? "#6B7280" : "#1F2937", cursor: rewardEditMode ? "pointer" : "default", textDecoration: claimed ? "line-through" : "none", borderBottom: rewardEditMode ? "1px dashed #D1D5DB" : "none", paddingBottom: 1 }}>{r.name}</span>}
          {rewardEditMode ? <input value={r.stars} onChange={e => { const n = [...rewards]; n[i] = { ...n[i], stars: parseInt(e.target.value.replace(/\D/g, "")) || 0 }; setRewards(n); }} style={{ width: 36, padding: "3px 2px", borderRadius: 5, border: "2px solid #FDE68A", fontFamily: "'Fredoka',sans-serif", fontSize: 11, fontWeight: 600, color: "#FBBF24", textAlign: "center", outline: "none", background: "#FFFBEB" }} /> : <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 11, color: "#FBBF24", fontWeight: 600 }}>{r.stars}⭐</span>}
          {rewardEditMode ? <button onClick={() => setConfirmDeleteReward(confirmDeleteReward === i ? null : i)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: confirmDeleteReward === i ? "#EF4444" : "#FEF2F2", color: confirmDeleteReward === i ? "#FFF" : "#EF4444", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🗑</button> : claimed ? <span style={{ fontSize: 12, color: "#34D399" }}>✓</span> : <button onClick={() => claimReward(i)} disabled={!can} style={{ padding: "4px 8px", borderRadius: 6, border: "none", fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, cursor: can ? "pointer" : "default", background: can ? "linear-gradient(135deg,#34D399,#059669)" : "#E5E7EB", color: can ? "#FFF" : "#9CA3AF", flexShrink: 0 }}>Claim</button>}
        </div>
        {confirmDeleteReward === i && <div style={{ display: "flex", gap: 6, padding: "6px 10px 8px", background: "#FEF2F2", borderTop: "1px dashed #FECACA" }}>
          <span style={{ flex: 1, fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#991B1B" }}>Delete this reward?</span>
          <button onClick={() => setConfirmDeleteReward(null)} style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#FFF", fontFamily: "'Fredoka',sans-serif", fontSize: 9, color: "#6B7280", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { setRewards(p => p.filter((_, j) => j !== i)); setClaimedRewards(prev => { const next = {}; Object.keys(prev).forEach(k => { const ki = parseInt(k); if (ki < i) next[ki] = prev[ki]; else if (ki > i) next[ki - 1] = prev[ki]; }); return next; }); setConfirmDeleteReward(null); }} style={{ padding: "2px 8px", borderRadius: 5, border: "none", background: "#EF4444", fontFamily: "'Fredoka',sans-serif", fontSize: 9, fontWeight: 600, color: "#FFF", cursor: "pointer" }}>Delete</button>
        </div>}
      </div>; })}</div>
      {showAddReward ? <div style={{ padding: 8, background: "#FFF", borderRadius: 9, marginBottom: 6 }}><div style={{ display: "flex", gap: 3, marginBottom: 4 }}>{["🎁","🍕","🍦","🎬","📚","🎡","🧸","🍰"].map(e => <button key={e} onClick={() => setNewRewardEmoji(e)} style={{ fontSize: 13, padding: 1, borderRadius: 3, border: newRewardEmoji === e ? "2px solid #A78BFA" : "1px solid transparent", cursor: "pointer" }}>{e}</button>)}</div><div style={{ display: "flex", gap: 4 }}><input value={newRewardName} onChange={e => setNewRewardName(e.target.value)} placeholder="Reward" style={{ flex: 1, padding: "5px 7px", borderRadius: 5, border: "1px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 10, outline: "none" }} /><input value={newRewardStars} onChange={e => setNewRewardStars(e.target.value.replace(/\D/g, ""))} placeholder="⭐" style={{ width: 40, padding: "5px", borderRadius: 5, border: "1px solid #E5E7EB", fontFamily: "'Nunito',sans-serif", fontSize: 10, outline: "none", textAlign: "center" }} /><button onClick={() => { if (!newRewardName.trim() || !newRewardStars) return; setRewards(p => [...p, { name: newRewardName, stars: parseInt(newRewardStars) || 50, emoji: newRewardEmoji }].sort((a, b) => a.stars - b.stars)); setNewRewardName(""); setNewRewardStars(""); setShowAddReward(false); }} style={{ ...BS, background: "linear-gradient(135deg,#FBBF24,#F59E0B)", color: "#FFF", fontSize: 10 }}>Add</button></div></div> : <button onClick={() => setShowAddReward(true)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "2px dashed #E5E7EB", background: "transparent", fontFamily: "'Fredoka',sans-serif", fontSize: 10, color: "#9CA3AF", cursor: "pointer" }}>＋ Add Reward</button>}
    </div>;
  };

  // ─── GAMES TAB (games only) ───────────────────────────────────────
  const GamesTab = () => {
    if (activeGame === "memory") return <MemoryGame onBack={() => setActiveGame(null)} theme={selectedGameTheme} onWin={handleMemoryWin} />;
    if (activeGame === "math") return <MathGame onBack={() => setActiveGame(null)} onScore={handleMathScore} />;
    if (activeGame === "riddle") return <RiddleGame onBack={() => setActiveGame(null)} onScore={handleRiddleScore} />;
    if (activeGame === "tongue") return <TongueTwisterGame onBack={() => setActiveGame(null)} />;
    if (activeGame === "joke") return <JokeGame onBack={() => setActiveGame(null)} />;
    return <div><div style={S.sectionHeader}><span>🎮 Games & Fun</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#FBBF24" }}>⭐{totalStars}</span></div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>🧠 Brain Games</div>
      <div style={{ marginBottom: 10 }}><div style={{ display: "flex", gap: 5, overflowX: "auto" }}>{GAME_THEMES.map((theme, i) => { const isU = theme.unlocked || unlockedItems[`theme-${i}`]; const isSel = selectedGameTheme === theme.name; return <div key={i} onClick={() => { if (isU) setSelectedGameTheme(theme.name); else if (theme.cost) unlockItem("theme", i, theme.cost); }} style={{ minWidth: 80, padding: "6px 8px", borderRadius: 10, cursor: "pointer", background: isSel ? `linear-gradient(135deg,${theme.colors[0]},${theme.colors[1]})` : isU ? "#FFF" : "#F3F4F6", border: isSel ? `2px solid ${theme.colors[1]}` : "2px solid #E5E7EB", opacity: isU ? 1 : .6 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, color: isSel ? "#FFF" : "#1F2937", whiteSpace: "nowrap" }}>{theme.name}</div>{!isU && <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 8, color: "#9CA3AF" }}>🔒{theme.cost}⭐</div>}</div>; })}</div></div>
      {[{ name: "Math Quest", icon: "🏰", desc: "Solve puzzles! +2⭐ each", color: "#FF6B6B", type: "math" }, { name: "Memory Match", icon: "🦋", desc: selectedGameTheme, color: "#4ECDC4", type: "memory" }].map((g, i) => <div key={i} onClick={() => setActiveGame(g.type)} style={{ padding: 12, marginBottom: 6, borderRadius: 12, cursor: "pointer", background: `${g.color}10`, border: `2px solid ${g.color}20` }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${g.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.icon}</div><div style={{ flex: 1 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{g.name}</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>{g.desc}</div></div><div style={{ fontSize: 13, color: g.color }}>▶</div></div></div>)}
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6, marginTop: 8 }}>😂 Fun & Laughter</div>
      {[
        { name: "Riddles", icon: "🧩", desc: "Brain teasers! +3⭐ each", color: "#FBBF24", type: "riddle" },
        { name: "Tongue Twisters", icon: "👅", desc: "Can you say it 3x fast?", color: "#A78BFA", type: "tongue" },
        { name: "Jokes", icon: "😂", desc: "Knock knock! Who's there?", color: "#60A5FA", type: "joke" },
      ].map((g, i) => <div key={i} onClick={() => setActiveGame(g.type)} style={{ padding: 12, marginBottom: 6, borderRadius: 12, cursor: "pointer", background: `${g.color}10`, border: `2px solid ${g.color}20` }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${g.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.icon}</div><div style={{ flex: 1 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{g.name}</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>{g.desc}</div></div><div style={{ fontSize: 13, color: g.color }}>▶</div></div></div>)}
    </div>;
  };

  const SubTabBar = ({ tabs, value, onChange }) => (
    <div style={{ display: "flex", gap: 3, marginBottom: 12, background: "#F3F4F6", borderRadius: 9, padding: 2, overflowX: "auto" }}>
      {tabs.map(t => <button key={t.key} onClick={() => { setActiveGame(null); onChange(t.key); }} style={{ flex: 1, minWidth: 66, padding: "7px 0", borderRadius: 7, border: "none", fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", background: value === t.key ? "#FFF" : "transparent", color: value === t.key ? "#1F2937" : "#9CA3AF", boxShadow: value === t.key ? "0 1px 3px rgba(0,0,0,.06)" : "none", whiteSpace: "nowrap" }}>{t.icon} {t.label}</button>)}
    </div>
  );

  const MathQuestCard = () => (
    <div>
      <div style={S.sectionHeader}><span>🏰 Math Quest</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#FBBF24" }}>⭐{totalStars}</span></div>
      <div onClick={() => setActiveGame("math")} style={{ padding: 14, borderRadius: 14, cursor: "pointer", background: "#FFF1F2", border: "2px solid #FFE4E6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: "#FF6B6B18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏰</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 14, color: "#1F2937" }}>Math Quest</div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "#6B7280" }}>Solve puzzles and earn +2⭐ each</div>
          </div>
          <div style={{ fontSize: 13, color: "#FF6B6B" }}>▶</div>
        </div>
      </div>
    </div>
  );

  const StudyPanel = () => {
    if (activeGame === "math") return <MathGame onBack={() => setActiveGame(null)} onScore={handleMathScore} />;
    const tabs = [{ key: "math", icon: "🏰", label: "Math" }, { key: "chinese", icon: "🀄", label: "Chinese" }, { key: "stem", icon: "🔬", label: "STEM" }, { key: "schedule", icon: "📚", label: "Plan" }];
    return <div>
      <SubTabBar tabs={tabs} value={studySubTab} onChange={setStudySubTab} />
      {studySubTab === "schedule" && StudyTab()}
      {studySubTab === "chinese" && ChineseTab()}
      {studySubTab === "stem" && <CraftTab onEarnStars={addStars} />}
      {studySubTab === "math" && <MathQuestCard />}
    </div>;
  };

  const MoreGamesTab = () => {
    if (activeGame === "memory") return <MemoryGame onBack={() => setActiveGame(null)} theme={selectedGameTheme} onWin={handleMemoryWin} />;
    if (activeGame === "riddle") return <RiddleGame onBack={() => setActiveGame(null)} onScore={handleRiddleScore} />;
    if (activeGame === "tongue") return <TongueTwisterGame onBack={() => setActiveGame(null)} />;
    if (activeGame === "joke") return <JokeGame onBack={() => setActiveGame(null)} />;
    if (activeGame === "drawing") return <DrawingGame onBack={() => setActiveGame(null)} />;
    return <div><div style={S.sectionHeader}><span>🎮 Games & Fun</span><span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, color: "#FBBF24" }}>⭐{totalStars}</span></div>
      <div style={{ marginBottom: 10 }}><div style={{ display: "flex", gap: 5, overflowX: "auto" }}>{GAME_THEMES.map((theme, i) => { const isU = theme.unlocked || unlockedItems[`theme-${i}`]; const isSel = selectedGameTheme === theme.name; return <div key={i} onClick={() => { if (isU) setSelectedGameTheme(theme.name); else if (theme.cost) unlockItem("theme", i, theme.cost); }} style={{ minWidth: 80, padding: "6px 8px", borderRadius: 10, cursor: "pointer", background: isSel ? `linear-gradient(135deg,${theme.colors[0]},${theme.colors[1]})` : isU ? "#FFF" : "#F3F4F6", border: isSel ? `2px solid ${theme.colors[1]}` : "2px solid #E5E7EB", opacity: isU ? 1 : .6 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, color: isSel ? "#FFF" : "#1F2937", whiteSpace: "nowrap" }}>{theme.name}</div>{!isU && <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 8, color: "#9CA3AF" }}>🔒{theme.cost}⭐</div>}</div>; })}</div></div>
      <div onClick={() => setActiveGame("drawing")} style={{ padding: 12, marginBottom: 6, borderRadius: 12, cursor: "pointer", background: "#EC489910", border: "2px solid #EC489920" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: "#EC489918", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎨</div><div style={{ flex: 1 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 13, color: "#1F2937" }}>Drawing Studio</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>Free draw or trace a theme</div></div><div style={{ fontSize: 13, color: "#EC4899" }}>▶</div></div></div>
      {[{ name: "Memory Match", icon: "🦋", desc: selectedGameTheme, color: "#4ECDC4", type: "memory" }, { name: "Riddles", icon: "🧩", desc: "Brain teasers! +3⭐ each", color: "#FBBF24", type: "riddle" }, { name: "Tongue Twisters", icon: "👅", desc: "Can you say it 3x fast?", color: "#A78BFA", type: "tongue" }, { name: "Jokes", icon: "😂", desc: "Knock knock! Who's there?", color: "#60A5FA", type: "joke" }].map((g, i) => <div key={i} onClick={() => setActiveGame(g.type)} style={{ padding: 12, marginBottom: 6, borderRadius: 12, cursor: "pointer", background: `${g.color}10`, border: `2px solid ${g.color}20` }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${g.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.icon}</div><div style={{ flex: 1 }}><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{g.name}</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 10, color: "#6B7280" }}>{g.desc}</div></div><div style={{ fontSize: 13, color: g.color }}>▶</div></div></div>)}
    </div>;
  };

  const MorePanel = () => {
    const tabs = [{ key: "games", icon: "🎮", label: "Game" }, { key: "news", icon: "📰", label: "News" }, { key: "love", icon: "💕", label: "Love" }];
    return <div>
      <SubTabBar tabs={tabs} value={moreSubTab} onChange={setMoreSubTab} />
      {moreSubTab === "games" && <MoreGamesTab />}
      {moreSubTab === "news" && NewsTab()}
      {moreSubTab === "love" && <LoveTab loveLog={loveLog} onKiss={handleKiss} onLoveYou={handleLoveYou} />}
    </div>;
  };

  const renderTab = () => {
    switch(activeTab) {
      case 0: return HomeTab();
      case 1: return <StudyPanel />;
      case 2: return DiaryTab();
      case 3: return <ChatRoom account={account} />;
      case 4: return MusicTab();
      case 5: return RewardTab();
      case 6: return <MorePanel />;
      default: return HomeTab();
    }
  };

  if (!dataLoaded) return (
    <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(135deg,#7C3AED,#A78BFA,#F472B6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 700, color: "#FFF" }}>Ava's World</div>
      <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 4 }}>Loading your stuff...</div>
    </div>
  );

  if (!hasAccount) return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" />
      <div style={S.content}>
        <AccountSetup onCreate={createAccount} />
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" />
      {showStarAnim && <FloatingStars key={"star-"+showStarAnim} count={showStarAnim} onDone={() => setShowStarAnim(null)} />}
      {showChat && <AiChat onClose={() => setShowChat(false)} />}
      <div style={S.topBar}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={S.avatar}>{accountInitial}</div><div><div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 15, color: "#1F2937" }}>Ava's World</div><div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 9, color: "#9CA3AF" }}>Daily companion 🌸</div></div></div><div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 13, fontWeight: 700, color: "#FBBF24", padding: "3px 9px", background: "#FFFBEB", borderRadius: 7 }}>⭐{totalStars}</div></div>
      <div style={S.content}>{renderTab()}</div>
      <button onClick={() => setShowChat(true)} style={{ position: "fixed", bottom: 58, right: 14, width: 44, height: 44, borderRadius: 22, background: "linear-gradient(135deg,#7C3AED,#A78BFA)", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, zIndex: 100 }}>🤖</button>
      <div style={S.bottomNav}>
        {TABS.map((tab, i) => <button key={i} onClick={() => { setActiveTab(i); setActiveGame(null); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "3px 0", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Fredoka',sans-serif", fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? "#7C3AED" : "#9CA3AF", minWidth: 0 }}><span style={{ fontSize: 14 }}>{tab}</span><span style={{ fontSize: 7, lineHeight: 1.2 }}>{TAB_LABELS[i]}</span>{activeTab === i && <div style={{ width: 8, height: 2, borderRadius: 1, background: "linear-gradient(90deg,#A78BFA,#7C3AED)", marginTop: 1 }} />}</button>)}
      </div>
    </div>
  );
}

const S = {
  app: { maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: "#FAFAFA", display: "flex", flexDirection: "column", fontFamily: "'Nunito',sans-serif", borderRadius: 24, overflowX: "hidden", overflowY: "auto", boxShadow: "0 4px 40px rgba(0,0,0,.08)", position: "relative" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: "#FFF", borderBottom: "1px solid #F3F4F6" },
  avatar: { width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#A78BFA,#F472B6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 13 },
  content: { flex: 1, padding: "10px 12px", overflowY: "auto", paddingBottom: 66, WebkitOverflowScrolling: "touch" },
  heroCard: { padding: "16px 14px", borderRadius: 14, background: "linear-gradient(135deg,#7C3AED,#A78BFA,#F472B6)", marginBottom: 12, position: "relative", overflow: "hidden" },
  statCard: { padding: "8px 3px", borderRadius: 9, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 14, color: "#1F2937", marginBottom: 8 },
  bottomNav: { display: "flex", justifyContent: "space-around", alignItems: "center", padding: "2px 0 6px", background: "#FFF", borderTop: "1px solid #F3F4F6", position: "sticky", bottom: 0 },
  backBtn: { padding: "5px 10px", borderRadius: 7, border: "none", fontFamily: "'Fredoka',sans-serif", fontSize: 10, fontWeight: 600, background: "#F3F4F6", color: "#6B7280", cursor: "pointer" },
};
