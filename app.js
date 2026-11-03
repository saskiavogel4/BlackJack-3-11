// Blackjack built on the Deck of Cards API (https://deckofcardsapi.com)
(() => {
  'use strict';

  const API = 'https://deckofcardsapi.com/api/deck';
  const CARD_BACK = 'https://deckofcardsapi.com/static/img/back.png';
  const DECK_COUNT = 6;
  const RESHUFFLE_AT = 75; // reshuffle the shoe when fewer cards remain
  const START_BANKROLL = 1000;
  const STORAGE_KEY = 'blackjack-bankroll';

  const $ = (id) => document.getElementById(id);
  const el = {
    bankroll: $('bankroll'), remaining: $('remaining'), bet: $('bet'), message: $('message'),
    dealerHand: $('dealer-hand'), playerHand: $('player-hand'),
    dealerScore: $('dealer-score'), playerScore: $('player-score'),
    betting: $('betting'), actions: $('actions'), next: $('next'),
    deal: $('deal'), clearBet: $('clear-bet'), hit: $('hit'), stand: $('stand'),
    double: $('double'), nextHand: $('next-hand'), reset: $('reset'),
    chips: document.querySelectorAll('[data-chip]'),
  };

  const state = {
    deckId: null,
    bankroll: loadBankroll(),
    bet: 0,
    player: [],
    dealer: [],
    holeHidden: true,
    busy: false,
  };

  // ---------- Deck of Cards API ----------
  async function api(path) {
    const res = await fetch(`${API}/${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API request failed');
    if (typeof data.remaining === 'number') el.remaining.textContent = data.remaining;
    return data;
  }

  let shoePromise = null;
  function newShoe() {
    // Share one in-flight request so a fast first click doesn't open two shoes.
    if (!shoePromise) {
      shoePromise = api(`new/shuffle/?deck_count=${DECK_COUNT}`)
        .then((data) => { state.deckId = data.deck_id; })
        .finally(() => { shoePromise = null; });
    }
    return shoePromise;
  }

  async function reshuffle() {
    await api(`${state.deckId}/shuffle/`); // returns all cards to the shoe
  }

  async function draw(count) {
    const data = await api(`${state.deckId}/draw/?count=${count}`);
    if (data.cards.length < count) {
      // Shoe ran dry mid-hand: reshuffle and draw the rest.
      await reshuffle();
      const more = await api(`${state.deckId}/draw/?count=${count - data.cards.length}`);
      return data.cards.concat(more.cards);
    }
    return data.cards;
  }

  // ---------- Scoring ----------
  function cardValue(card) {
    if (card.value === 'ACE') return 11;
    if (['KING', 'QUEEN', 'JACK'].includes(card.value)) return 10;
    return parseInt(card.value, 10);
  }

  function handTotal(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      total += cardValue(c);
      if (c.value === 'ACE') aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }

  const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).total === 21;

  // ---------- Rendering ----------
  function cardImg(card, hidden) {
    const img = document.createElement('img');
    img.src = hidden ? CARD_BACK : card.image;
    img.alt = hidden ? 'Face-down card' : `${card.value} of ${card.suit}`;
    return img;
  }

  function render() {
    el.bankroll.textContent = `$${state.bankroll}`;
    el.bet.textContent = `$${state.bet}`;

    el.playerHand.replaceChildren(...state.player.map((c) => cardImg(c, false)));
    el.dealerHand.replaceChildren(...state.dealer.map((c, i) => cardImg(c, i === 1 && state.holeHidden)));

    el.playerScore.textContent = state.player.length ? formatTotal(state.player) : '';
    if (!state.dealer.length) el.dealerScore.textContent = '';
    else if (state.holeHidden) el.dealerScore.textContent = handTotal([state.dealer[0]]).total;
    else el.dealerScore.textContent = handTotal(state.dealer).total;

    el.chips.forEach((chip) => {
      chip.disabled = state.busy || Number(chip.dataset.chip) + state.bet > state.bankroll;
    });
    el.deal.disabled = state.busy || state.bet === 0;
    el.clearBet.disabled = state.busy || state.bet === 0;
  }

  function formatTotal(cards) {
    const { total, soft } = handTotal(cards);
    return soft && total < 21 ? `${total - 10}/${total}` : String(total);
  }

  function setMessage(text, tone) {
    el.message.textContent = text;
    el.message.classList.toggle('lose', tone === 'lose');
  }

  function showPhase(phase) {
    el.betting.classList.toggle('hidden', phase !== 'betting');
    el.actions.classList.toggle('hidden', phase !== 'playing');
    el.next.classList.toggle('hidden', phase !== 'done');
    el.reset.classList.toggle('hidden', !(phase === 'betting' && state.bankroll < 5 && state.bet === 0));
  }

  function setBusy(busy) {
    state.busy = busy;
    [el.hit, el.stand, el.double].forEach((b) => (b.disabled = busy));
    if (!busy) el.double.disabled = state.player.length !== 2 || state.bankroll < state.bet;
    render();
  }

  // ---------- Persistence ----------
  function loadBankroll() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(v) && v >= 0 ? v : START_BANKROLL;
    } catch { return START_BANKROLL; }
  }
  function saveBankroll() {
    try { localStorage.setItem(STORAGE_KEY, String(state.bankroll)); } catch { /* ignore */ }
  }

  // ---------- Game flow ----------
  async function deal() {
    if (state.bet === 0 || state.busy) return;
    state.bankroll -= state.bet; // bet goes on the table
    saveBankroll();
    state.player = [];
    state.dealer = [];
    state.holeHidden = true;
    showPhase('playing');
    setBusy(true);
    setMessage('Dealing…');

    try {
      if (!state.deckId) await newShoe();
      else if (Number(el.remaining.textContent) < RESHUFFLE_AT) {
        setMessage('Shuffling the shoe…');
        await reshuffle();
      }
      const [p1, d1, p2, d2] = await draw(4);
      state.player = [p1, p2];
      state.dealer = [d1, d2];
    } catch (err) {
      return handleError(err);
    }

    const playerBJ = isBlackjack(state.player);
    const dealerBJ = isBlackjack(state.dealer);
    if (playerBJ || dealerBJ) {
      state.holeHidden = false;
      if (playerBJ && dealerBJ) return finish('push', 'Both have Blackjack — push.');
      if (playerBJ) return finish('blackjack', 'Blackjack! You win 3:2.');
      return finish('lose', 'Dealer has Blackjack.');
    }

    setMessage('Hit, stand, or double?');
    setBusy(false);
  }

  async function hit() {
    if (state.busy) return;
    setBusy(true);
    try {
      state.player.push(...(await draw(1)));
    } catch (err) {
      return handleError(err);
    }
    const { total } = handTotal(state.player);
    if (total > 21) {
      state.holeHidden = false;
      return finish('lose', `Bust with ${total}. Dealer wins.`);
    }
    if (total === 21) return dealerTurn();
    setBusy(false);
  }

  async function doubleDown() {
    if (state.busy || state.player.length !== 2 || state.bankroll < state.bet) return;
    state.bankroll -= state.bet;
    state.bet *= 2;
    saveBankroll();
    setBusy(true);
    try {
      state.player.push(...(await draw(1)));
    } catch (err) {
      return handleError(err);
    }
    const { total } = handTotal(state.player);
    if (total > 21) {
      state.holeHidden = false;
      return finish('lose', `Bust with ${total}. Dealer wins.`);
    }
    return dealerTurn();
  }

  async function dealerTurn() {
    setBusy(true);
    state.holeHidden = false;
    setMessage('Dealer plays…');
    render();

    try {
      // Dealer stands on all 17s.
      while (handTotal(state.dealer).total < 17) {
        await pause(450);
        state.dealer.push(...(await draw(1)));
        render();
      }
    } catch (err) {
      return handleError(err);
    }

    const p = handTotal(state.player).total;
    const d = handTotal(state.dealer).total;
    if (d > 21) return finish('win', `Dealer busts with ${d}. You win!`);
    if (p > d) return finish('win', `You win, ${p} to ${d}!`);
    if (p < d) return finish('lose', `Dealer wins, ${d} to ${p}.`);
    return finish('push', `Push at ${p}.`);
  }

  function finish(result, text) {
    const payout = {
      blackjack: state.bet + Math.floor(state.bet * 1.5),
      win: state.bet * 2,
      push: state.bet,
      lose: 0,
    }[result];
    state.bankroll += payout;
    saveBankroll();
    state.lastBet = state.bet;
    setMessage(text, result === 'lose' ? 'lose' : undefined);
    showPhase('done');
    setBusy(false);
  }

  function nextHand() {
    state.player = [];
    state.dealer = [];
    // Re-use the previous bet if still affordable.
    state.bet = state.lastBet && state.lastBet <= state.bankroll ? state.lastBet : 0;
    setMessage(state.bankroll < 5 && state.bet === 0 ? 'Out of chips!' : 'Place your bet.');
    showPhase('betting');
    render();
  }

  function handleError(err) {
    console.error(err);
    // Refund the bet on the table and return to betting.
    state.bankroll += state.bet;
    saveBankroll();
    state.player = [];
    state.dealer = [];
    state.deckId = null; // grab a fresh shoe on the next deal
    setMessage('Could not reach the Deck of Cards API. Your bet was returned — try again.', 'lose');
    showPhase('betting');
    setBusy(false);
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Events ----------
  el.chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const amt = Number(chip.dataset.chip);
      if (state.bet + amt <= state.bankroll) { state.bet += amt; render(); }
    })
  );
  el.clearBet.addEventListener('click', () => { state.bet = 0; render(); });
  el.deal.addEventListener('click', deal);
  el.hit.addEventListener('click', hit);
  el.stand.addEventListener('click', dealerTurn);
  el.double.addEventListener('click', doubleDown);
  el.nextHand.addEventListener('click', nextHand);
  el.reset.addEventListener('click', () => {
    state.bankroll = START_BANKROLL;
    state.bet = 0;
    saveBankroll();
    setMessage('Bankroll reset. Place your bet.');
    showPhase('betting');
    render();
  });

  showPhase('betting');
  render();
  // Warm up a shoe in the background so the first deal is fast.
  newShoe().catch(() => {});
})();
