const STORAGE_KEY = 'cmp-silicon-gamble-v1';
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"balance":10000,"cards":[],"ended":false}');
state.bricks = state.bricks || [];
state.unstable = state.unstable || [];
state.stock3090 = state.stock3090 ?? 1;
state.won = state.won || false;
let rolling = false;
let pendingVerification = null;
let pendingRefundId = null;
const $ = s => document.querySelector(s);
const money = n => '$' + n.toLocaleString('en-US');
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function totalVram(){ return state.cards.reduce((total, card) => total + (card.memory || 8), 0) + state.unstable.reduce((total, card) => total + (card.memory || 10), 0); }
function render(){
  $("#balance").textContent = money(state.balance);
  const vram = totalVram();
  $("#vram").textContent = vram;
  const items = state.cards.length + state.bricks.length + state.unstable.length;
  document.querySelector("#inventoryCount").textContent = `${items} ITEM${items === 1 ? "" : "S"}`;
  $("#mission").textContent = vram >= 64 ? "MISSION COMPLETE!" : "REACH 64 GB VRAM";
  const inv = document.querySelector("#inventory"); inv.innerHTML = "";
  if (!items) inv.innerHTML = `<p class="empty">Your rig is empty. Your wallet still has hope.</p>`;
  state.cards.forEach((card, i) => { const memory = card.memory || 8; const status = card.ewaste ? "E-WASTE" : (card.awaiting ? "PENDING STABILITY CHECK" : (memory >= 64 ? `UNLOCKED: ${memory} GB` : "")); const button = card.ewaste ? `<button class="sell-button" data-group="cards" data-id="${card.id}" data-price="2500">SELL $2,500</button>` : (card.awaiting ? `<button class="upgrade-button verify-button" data-group="cards" data-id="${card.id}">VERIFY STABILITY</button>` : (memory < 64 ? `<button class="upgrade-button" data-group="cards" data-id="${card.id}" data-target="64">UNLOCK VRAM</button>` : "")); inv.insertAdjacentHTML("beforeend", `<article class="inventory-card ${card.ewaste ? "ewaste-card" : ""}"><div class="gpu ${card.ewaste ? "gpu-cmp-bad" : "gpu-cmp"}"></div><h3>CMP 170HX 8 GB #${String(i+1).padStart(2,"0")}</h3>${status ? `<p>${status}</p>` : ""}${button}</article>`); });
  state.unstable.forEach((card, i) => { const memory = card.memory || 10; const status = card.ewaste ? "E-WASTE" : (card.awaiting ? "PENDING STABILITY CHECK" : (memory >= 40 ? `UNLOCKED: ${memory} GB` : "")); const button = card.ewaste ? `<button class="sell-button" data-group="unstable" data-id="${card.id}" data-price="1500">SELL $1,500</button>` : (card.awaiting ? `<button class="upgrade-button verify-button" data-group="unstable" data-id="${card.id}">VERIFY STABILITY</button>` : (memory < 40 ? `<button class="upgrade-button" data-group="unstable" data-id="${card.id}" data-target="40">UNLOCK VRAM</button>` : "")); inv.insertAdjacentHTML("beforeend", `<article class="inventory-card unstable-card ${card.ewaste ? "ewaste-card" : ""}"><div class="gpu ${card.ewaste ? "gpu-cmp-bad" : "gpu-cmp"}"></div><h3>CMP 170HX 10 GB #${String(i+1).padStart(2,"0")}</h3>${status ? `<p>${status}</p>` : ""}${button}</article>`); });
  state.bricks.forEach((brickCard, i) => { const button = brickCard.claimable ? `<button class="refund-button" data-id="${brickCard.id}">REQUEST REFUND</button>` : ""; inv.insertAdjacentHTML("beforeend", `<article class="inventory-card junk-card"><div class="brick"></div><h3>BRICK #${String(i+1).padStart(2,"0")}</h3>${button}</article>`); });
  document.querySelectorAll("[data-card]").forEach(b => { if(b.dataset.card !== "CMP" && b.dataset.card !== "4090") b.disabled = state.ended || state.balance < +b.dataset.price || (b.dataset.card === "3090" && state.stock3090 < 1); });
  $("#cmpBuy").disabled = rolling || state.ended || state.balance < 2500;
  document.querySelectorAll(".upgrade-button:not(.verify-button)").forEach(button => button.addEventListener("click", () => { const group = state[button.dataset.group]; const card = group.find(item => String(item.id) === button.dataset.id); if (!card) return; card.pendingMemory = +button.dataset.target; card.awaiting = true; pendingVerification = { group: button.dataset.group, id: card.id }; save(); render(); runUnlockAnimation(card.pendingMemory); }));
  document.querySelectorAll(".verify-button").forEach(button => button.addEventListener("click", () => { const group = state[button.dataset.group]; const card = group.find(item => String(item.id) === button.dataset.id); if (!card) return; pendingVerification = { group: button.dataset.group, id: card.id }; runVerification(); }));
  document.querySelectorAll(".sell-button").forEach(button => button.addEventListener("click", () => { const group = state[button.dataset.group]; const index = group.findIndex(item => String(item.id) === button.dataset.id); if(index < 0) return; const price = +button.dataset.price; group.splice(index, 1); state.balance += price; save(); render(); showMessage("E-WASTE SOLD", `Another GPU hunter paid ${money(price)} for it. The marketplace has claimed another victim.`, "gpu gpu-cmp-bad"); }));
  document.querySelectorAll(".refund-button").forEach(button => button.addEventListener("click", () => { pendingRefundId = button.dataset.id; requestRefund(); }));
}
function showMessage(title, text, art='gpu gpu-cmp', action='CONTINUE', secondary=''){
  $('#slotArea').classList.add('hidden'); $('#modalMessage').classList.remove('hidden');
  $("#terminalArea").classList.add("hidden");
  $('#resultArt').className = `result-art ${art}`; $('#modalTitle').textContent = title; $('#modalText').textContent = text; $('#modalAction').textContent = action; const secondaryButton = $('#modalSecondary'); secondaryButton.textContent = secondary; secondaryButton.classList.toggle('hidden', !secondary);
  $('#modal').classList.remove('hidden');
}
function runUnlockAnimation(target){ $("#slotArea").classList.add("hidden"); $("#modalMessage").classList.add("hidden"); $("#terminalArea").classList.remove("hidden"); $("#modal").classList.remove("hidden"); const output = $("#terminalOutput"); const lines = ["[BOOT] CMP firmware flasher v1.7", "[WARN] Warranty bit already missing.", "[MAP] Searching for hidden VRAM banks...", `[PATCH] Redirecting memory map to ${target} GB...`, "[FLASH] Writing extremely official firmware...", "[DONE] Reboot required. Probably."]; let index = 0; output.textContent = ""; const timer = setInterval(() => { output.textContent += lines[index++] + "\n"; if(index === lines.length){ clearInterval(timer); setTimeout(() => showMessage("FIRMWARE UNLOCK READY", `Memory remap to ${target} GB is staged. Verify stability before trusting this card.`, "gpu gpu-cmp", "VERIFY STABILITY"), 500); } }, 360); }
function requestRefund(){ const index = state.bricks.findIndex(item => String(item.id) === String(pendingRefundId)); pendingRefundId = null; if(index < 0) return; const brickCard = state.bricks[index]; const approved = Math.random() < 0.2; if(approved){ const percent = Math.floor(Math.random() * 61) + 10; const amount = Math.round((2500 * percent) / 100); state.bricks.splice(index, 1); state.balance += amount; save(); render(); showMessage("REFUND APPROVED", `The seller returned ${percent}% of your payment: ${money(amount)}. The brick has been sent back to wherever it came from.`, "result-art brick"); } else { brickCard.claimable = false; save(); render(); showMessage("SELLER DISAPPEARED", "The seller deleted the listing, changed their username, and stopped replying. You keep the brick. They keep the money.", "result-art brick"); } }
function runVerification(){ if(!pendingVerification) return; $("#modal").classList.remove("hidden"); $("#modalMessage").classList.add("hidden"); $("#terminalArea").classList.remove("hidden"); const output = $("#terminalOutput"); const lines = ["[BOOT] CMP memory diagnostic v0.9", "[SCAN] Mapping hidden memory banks...", "[TEST] Writing pseudo-random patterns...", "[TEST] Reading back 0xDEADBEEF...", "[HEAT] Pretending to monitor thermals...", "[RESULT] Finalizing stability verdict..."]; let index = 0; output.textContent = ""; const timer = setInterval(() => { output.textContent += lines[index++] + "\n"; if(index === lines.length){ clearInterval(timer); setTimeout(() => { const {group, id} = pendingVerification; pendingVerification = null; const card = state[group].find(item => item.id === id); if(!card) return; const stable = Math.random() >= .5; card.awaiting = false; if(stable){ card.memory = card.pendingMemory; delete card.pendingMemory; save(); render(); if(card.memory === 64 && !state.won){ state.won = true; save(); showMessage("MISSION COMPLETE!", "You unlocked 64 GB on one CMP. But wait... maybe 96 GB is possible after all. Please do not tell your wallet.", "gpu gpu-cmp", "KEEP GAMBLING"); } else { showMessage("STABILITY VERIFIED!", `Memory test passed. CMP 170HX is running at ${card.memory} GB. Suspiciously good.`, "gpu gpu-cmp"); } } else { card.ewaste = true; delete card.pendingMemory; save(); render(); showMessage("MEMORY FAILURE", `The extra memory failed testing. Original capacity: ${card.memory || (group === "cards" ? 8 : 10)} GB. Further unlock attempts are off the table. The seller calls this “working as intended.”`, "gpu gpu-cmp-bad"); } }, 500); } }, 360); }
function endWithSafeCard(name, price, cardType){
  if (state.balance < price || (cardType === "3090" && state.stock3090 < 1)) return;
  state.balance -= price; if(cardType === "3090") state.stock3090 = 0; state.ended = true; save(); render();
  const message = cardType === "V100" ? "You bought a museum piece with a heatsink. GAME OVER: nostalgia does not unlock VRAM." : `Your ${name} is on its way. A sensible purchase. A terrible plot twist. GAME OVER: you left the CMP challenge.`; showMessage("PURCHASE CONFIRMED", message, `gpu gpu-${cardType.toLowerCase()}`, "START OVER");
}
function brick(){ const d=document.createElement('div'); d.className='brick'; return d; }
function gpu(){ const d=document.createElement('div'); d.className='gpu gpu-cmp'; d.innerHTML='<span>CMP</span><em>?</em>'; return d; }
function startRoll(){
  if (rolling || state.balance < 2500 || state.ended) return;
  rolling = true; state.balance -= 2500; save(); render();
  $('#modal').classList.remove('hidden'); $('#modalMessage').classList.add('hidden'); $('#slotArea').classList.remove('hidden');
  const result = Math.random() < .48 ? 'brick' : (Math.random() < .58 ? '8gb' : '10gb');
  const reel = $('#reel'); reel.innerHTML = '';
  for(let i=0;i<20;i++) reel.appendChild(i===17 ? (result==='brick'?brick():gpu()) : (Math.random()<.5?brick():gpu()));
  reel.style.transition='none'; reel.style.transform='translateX(0)';
  const winningCard = reel.children[17];
  const winningOffset = winningCard.offsetLeft + winningCard.offsetWidth / 2 - document.querySelector('.slot-window').clientWidth / 2;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ reel.style.transition='transform 3.8s cubic-bezier(.08,.75,.14,1)'; reel.style.transform='translateX(-' + winningOffset + 'px)'; }));
  setTimeout(()=>{
    rolling=false;
    render();
    if(result === "brick"){ const brickCard = {id:Date.now(), claimable:true}; state.bricks.push(brickCard); pendingRefundId = brickCard.id; save(); render(); showMessage("YOU GOT A BRICK!", "A truly industrial-grade brick. You could try asking the seller for a refund.", "result-art brick", "REQUEST REFUND"); }
    else if(result === "10gb") showMessage("10 GB OF PURE UNCERTAINTY", "It reports 10 GB — impressive at first glance. The seller promises an 80 GB unlock and has already disabled comments. Sell it for $1,500, or keep it.", "gpu gpu-cmp", "SELL FOR $1,500", "KEEP");
    else { state.cards.push({id:Date.now(), memory:8}); save(); render(); showMessage("8 GB CMP FOUND!", "An 8 GB CMP joins your rig. The memory is limited. The seller’s promises were not.", "gpu gpu-cmp"); }
  }, 4100);
}
$('#cmpBuy').addEventListener('click', startRoll);
document.querySelectorAll(".normal button").forEach(button => button.addEventListener("click", () => { const names = {5090:"RTX 5090", 3090:"RTX 3090", A100:"Tesla A100", V100:"Tesla V100"}; endWithSafeCard(names[button.dataset.card], +button.dataset.price, button.dataset.card); }));
$("#modalAction").addEventListener("click",()=>{
  const title=$("#modalTitle").textContent;
  if(pendingVerification){ runVerification(); return; }
  if(title === "YOU GOT A BRICK!"){ requestRefund(); return; }
  if(title === "10 GB OF PURE UNCERTAINTY"){ state.balance += 1500; save(); render(); }
  if(state.ended && title === "PURCHASE CONFIRMED"){ state={balance:10000,cards:[],bricks:[],unstable:[],stock3090:1,won:false,ended:false}; save(); render(); }
  $("#modal").classList.add("hidden");
});
$("#modalSecondary").addEventListener("click",()=>{ if($("#modalTitle").textContent === "10 GB OF PURE UNCERTAINTY"){ state.unstable.push({id:Date.now(), memory:10}); save(); render(); } $("#modal").classList.add("hidden"); });
$("#resetButton").addEventListener("click",()=>{ if(confirm("Erase this saved rig and start again?")){ state={balance:10000,cards:[],bricks:[],unstable:[],stock3090:1,won:false,ended:false}; save(); render(); } });
render();
