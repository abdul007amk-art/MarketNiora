const test=require('node:test'); const assert=require('node:assert/strict');
const {Dars12Engine,Dars12Store,toCatalystCandidate}=require('../backend/src/dars12/dars12Engine.ts');

const base=(o={})=>({sourceEventId:'evt-1',source:'SOURCE_A',symbol:'AAA',value:'1.25',sourceTimestamp:100,effectiveTime:100,knowledgeTime:100,verificationStatus:'VERIFIED',dataNature:'RAW',formulaVersion:null,...o});
const sum=e=>e.map(x=>x.value).join('+');

test('DARS12 adversarial: future knowledge_time is rejected before canonical write',()=>{
  const s=new Dars12Store(), e=new Dars12Engine(s);
  const r=e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({knowledgeTime:201})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
  assert.equal(r.formulaExecuted,false);
  assert.equal(r.truthState,'BLOCKED');
  assert.equal(s.allEvidence().length,0);
  assert.match(r.errors[0],/knowledgeTime cannot be in the future of the run/);
});

test('DARS12 adversarial: exact knowledge_time boundary is included in reconstruction',()=>{
  const s=new Dars12Store(), e=new Dars12Engine(s);
  e.run({runKnowledgeTime:100,providerHealthy:true,rawEvents:[base({knowledgeTime:100})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
  assert.equal(s.reconstruct(99).length,0);
  assert.equal(s.reconstruct(100).length,1);
  assert.equal(s.reconstruct(100)[0].knowledgeTime,100);
});

test('DARS12 adversarial: identical duplicate source_event_id in one batch commits exactly one canonical event',()=>{
  const s=new Dars12Store(), e=new Dars12Engine(s);
  const r=e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base(),base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
  assert.equal(r.formulaExecuted,true);
  assert.deepEqual(r.duplicateSourceEventIds,['evt-1']);
  assert.equal(s.allEvidence().length,1);
});

test('DARS12 adversarial: refresh rollback followed by identical retry is deterministic',()=>{
  const s=new Dars12Store(), e=new Dars12Engine(s);
  const input={runKnowledgeTime:300,providerHealthy:true,rawEvents:[base({sourceEventId:'evt-2',value:'2.50',knowledgeTime:300})],evidenceRefreshSucceeded:false,formulaVersion:'F1',formula:sum};
  const failed=e.run(input);
  assert.equal(failed.formulaExecuted,false);
  assert.equal(s.allEvidence().length,0);
  const retry=e.run({...input,evidenceRefreshSucceeded:true});
  assert.equal(retry.formulaExecuted,true);
  assert.equal(retry.formulaOutput,'2.50');
  assert.equal(s.allEvidence().length,1);
});

test('DARS12 adversarial: OCE candidate rejects every non-qualifying truth/verification/origin state',()=>{
  const cases=[
    base({origin:'OCE',verificationStatus:'UNVERIFIED'}),
    base({origin:'OCE',verificationStatus:'SOURCE_REQUIRED'}),
    base({origin:'OCE',truthState:'STALE'}),
    base({origin:'OCE',truthState:'BLOCKED'}),
    base({origin:'STANDARD',verificationStatus:'VERIFIED'})
  ];
  for(const e of cases) assert.equal(toCatalystCandidate(e),null);
});

test('DARS12 adversarial: formula callback receives only current as-of evidence',()=>{
  const s=new Dars12Store(), e=new Dars12Engine(s);
  e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
  let received=[];
  const r=e.run({runKnowledgeTime:300,providerHealthy:true,rawEvents:[base(),base({sourceEventId:'evt-2',symbol:'BBB',knowledgeTime:300})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:ev=>{received=ev.map(x=>x.evidenceKey); return 'ok';}});
  assert.equal(r.formulaExecuted,true);
  assert.deepEqual(received,['SOURCE_A|AAA','SOURCE_A|BBB']);
});
