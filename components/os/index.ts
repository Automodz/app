/**
 * THE OS PRIMITIVES.
 *
 * The atoms of the ratified customer design ("AutoModz App.dc.html"), which
 * the twelve screens compose and never re-implement. `components/system` is
 * the older, broader kit — `Text`, `Hero`, `Button`, `Section`; these are the
 * shapes that kit has no word for: a dial, a pane of glass, a meter, a label.
 */
export { Pane } from './Pane';
export type { PaneProps, PaneTone } from './Pane';

export { Dial, Unit } from './Dial';
export type { DialProps } from './Dial';

export { Screen } from './Screen';

export {
  Label, Statement, Rail, Pulse, Chevron, Meter, Row, Value, Action, Stat,
} from './parts';
