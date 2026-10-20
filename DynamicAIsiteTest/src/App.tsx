import {useEffect} from 'react';
import {Footer, Header} from './components/Chrome';
import {Earthrise} from './components/Earthrise';
import {MissionLog} from './components/MissionLog';
import {Missions} from './components/Missions';
import {Reserve} from './components/Reserve';
import {Trajectory} from './components/Trajectory';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';

export default function App() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Header />
      <main>
        <Earthrise />
        <MissionLog />
        <Trajectory />
        <Missions />
        <Reserve />
      </main>
      <Footer />
    </>
  );
}
