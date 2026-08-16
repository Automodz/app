/**
 * THE OS PRIMITIVES.
 *
 * The atoms of the ratified customer design ("AutoModz App.dc.html"), which
 * the twelve screens compose and never re-implement. `components/system` is
 * the older, broader kit - `Text`, `Hero`, `Button`, `Section`; these are the
 * shapes that kit has no word for: a dial, a pane of glass, a meter, a label.
 */
export { Pane } from './Pane';
export type { PaneProps, PaneTone } from './Pane';

export { Dial, Unit } from './Dial';
export type { DialProps } from './Dial';

export { Screen } from './Screen';

export { Photograph } from './Photograph';
export type { PhotographProps, PhotographState } from './Photograph';

export { RoomHeader, Back } from './RoomHeader';
export type { RoomHeaderProps } from './RoomHeader';

export {
  Label, Statement, DISPLAY, Rail, Pulse, Chevron, Meter, Row, Value, Action, Stat,
} from './parts';
export { Greeting } from './Greeting';

/* The doorway that marks itself seen - see the file for the defect it closes. */
export { Notice, markSeen } from './Notice';
