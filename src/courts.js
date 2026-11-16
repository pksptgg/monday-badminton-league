// Spread an ordered list of matches over the courts in use.
// Each "giliran" (turn) fills up to `courts` matches that share no team, keeping the
// suggestion order as far as possible; with one court this is the order unchanged.
export function normalizeCourts(value) {
  const courts = Number(value);
  return Number.isInteger(courts) && courts >= 1 && courts <= 4 ? courts : 1;
}

export function assignCourts(order, courts = 1) {
  const count = normalizeCourts(courts);
  const remaining = [...order];
  const turns = [];
  while (remaining.length) {
    const used = new Set();
    const turn = [];
    for (let index = 0; index < remaining.length && turn.length < count;) {
      const match = remaining[index];
      if (!used.has(match.homeTeamId) && !used.has(match.awayTeamId)) {
        turn.push(match);
        used.add(match.homeTeamId);
        used.add(match.awayTeamId);
        remaining.splice(index, 1);
      } else {
        index++;
      }
    }
    turns.push(turn);
  }
  return turns.flatMap((turn, turnIndex) => turn.map((match, courtIndex) => ({ match, turn: turnIndex + 1, court: courtIndex + 1 })));
}
