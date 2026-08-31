// Browser-only synthetic visual evidence. Not an application route or official draw.
// Serve with the existing Vite dev server. No database or production commands.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { UiThemeContext } from '../../../../src/shared/ui/ui-theme.ts'
import { ProductionDrawPresentation, PresentationSupport } from '../../../../src/ui/operator/draw/ProductionDrawPresentation.tsx'
import { PresentationRecoveryDialog } from '../../../../src/ui/operator/draw/PresentationRecoveryDialog.tsx'
import { DrawControlDeck } from '../../../../src/pages/operator/DrawSessionQueuePage.tsx'
import { AudiencePresentation } from '../../../../src/ui/audience/AudiencePresentation.tsx'
import { projectPublicDisplaySnapshot } from '../../../../src/application/display-transport/public-projection.ts'
import '../../../../src/styles/app.css'

const id = '00000000-0000-4000-8000-000000000003'
const stamp = '2030-08-05T00:00:00.000Z'
const connection = { label: 'Terhubung', detail: 'Snapshot sintetis dikonfirmasi.', tone: 'success', acknowledged: true }
const configuration = { presentationMode: 'random-number-roll', rollStopMode: 'manual', rollDurationSeconds: 8, rollSpeedPerSecond: 12, revealMode: 'all-together' }
const noop = () => undefined
function Fixture() {
  const [surface, setSurface] = useState('monitor')
  const [stage, setStage] = useState('reveal')
  const [count, setCount] = useState(6)
  const [mode, setMode] = useState('practice')
  const [theme, setTheme] = useState('kocokan')
  const [blackout, setBlackout] = useState(false)
  const [failure, setFailure] = useState('')
  const result = { drawSessionId: id, winners: Array.from({length:count}, (_, index) => ({winnerId:`00000000-0000-4000-8000-${String(index+10).padStart(12,'0')}`,sequence:index+1,ticketNumber:String(index+42).padStart(5,'0')})) }
  const snapshot = projectPublicDisplaySnapshot({drawSessionId:id,stage:stage === 'ready' ? 'standby' : stage,stageStartedAt:stamp,blackoutRequested:blackout,mode:'practice',eventName:'UJI VISUAL — BUKAN HASIL RESMI',prizeName:'Hadiah Console',prizeCategory:'Door Prize',result,presentationConfiguration:{...configuration,winnerCount:count},countdownValue:3,presentationSeed:id})
  const recap = {winnerCount:count,eligibleCount:100,winningRule:'once-per-event',countdownSeconds:3,rollingSeconds:8,presentationConfiguration:configuration}
  const item = (itemMode) => ({action:{kind:'run',to:`/draw/run/${itemMode}`},category:{id:'fixture-prize',name:'Door Prize',prizeName:'Hadiah Console'},checkpoint:null,event:{id,name:'UJI VISUAL — BUKAN HASIL RESMI'},relation:'valid',session:{id:`fixture-${itemMode}`,mode:itemMode,status:'ready',updatedAt:stamp},winnerCount:count})
  return <MemoryRouter><div style={{background:'#f6f3ed',minHeight:'100vh',padding:24}}>
    <fieldset style={{display:'flex',gap:16,flexWrap:'wrap',padding:12,marginBottom:20,background:'#fff',color:'#24212b',font:'14px system-ui'}}>
      <legend>Fixture sintetis — tidak menjalankan draw resmi</legend>
      <label>Surface <select value={surface} onChange={event=>setSurface(event.target.value)}>{['monitor','queue','runtime','recovery','audience'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Stage <select value={stage} onChange={event=>setStage(event.target.value)}>{['ready','countdown','rolling','reveal','pending-handoff'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Winners <select value={count} onChange={event=>setCount(Number(event.target.value))}>{[1,6,10,20,50,100].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Theme <select value={theme} onChange={event=>setTheme(event.target.value)}><option>kocokan</option><option>legacy</option></select></label>
      <label><input type="checkbox" checked={blackout} onChange={event=>setBlackout(event.target.checked)} />Blackout fixture</label>
      <output>{failure}</output>
    </fieldset>
    <UiThemeContext.Provider value={theme}><div data-ui-theme={theme === 'kocokan' ? theme : undefined}>
      {surface === 'monitor' ? <div style={{width:600,maxWidth:'100%'}}><PresentationSupport recap={recap} previewStage={stage} audienceStatus={connection} eventName={snapshot.eventName} prizeCategory="Door Prize" prizeName="Hadiah Console" result={result} blackoutRequested={blackout} publicSnapshot={snapshot} displayConfiguration={{safeAreaMargin:48,blackoutAppearance:'pure-black',targetResolution:{width:1920,height:1080}}} /></div> : null}
      {surface === 'queue' ? <DrawControlDeck connection={connection} displayUrl={null} deck={{key:'fixture',categoryName:'Door Prize',eventName:snapshot.eventName,prizeName:'Hadiah Console',winnerCount:count,defaultMode:'practice',sessions:{practice:item('practice'),live:item('live')}}} selectedMode={mode} setSelectedMode={setMode} /> : null}
      {surface === 'runtime' ? <ProductionDrawPresentation key={`${stage}-${count}-${blackout}`} result={result} mode="practice" eventId="slice3-visual-fixture" displayConfigurationId="slice3-visual-fixture" eventName={snapshot.eventName} prizeCategory="Door Prize" prizeName="Hadiah Console" practiceResult={{...result,createdAt:stamp,policyVersion:1}} initialPresentation={{stage:stage === 'ready' ? 'reveal' : stage,stageStartedAt:stamp,blackoutRequested:blackout}} presentationConfiguration={configuration} audienceStatus={connection} recap={recap} onFailure={error=>setFailure(error.message)} onHandoff={noop} onResetPractice={noop} /> : null}
      {surface === 'recovery' ? <PresentationRecoveryDialog onBackToSetup={()=>setSurface('monitor')} onReviewPendingResults={()=>setSurface('monitor')} reviewPendingResultsAvailable /> : null}
      {surface === 'audience' ? <AudiencePresentation snapshot={snapshot} displayConfiguration={{safeAreaMargin:48,blackoutAppearance:'pure-black',targetResolution:{width:1920,height:1080}}} /> : null}
    </div></UiThemeContext.Provider>
  </div></MemoryRouter>
}
createRoot(document.getElementById('root')).render(<Fixture />)
