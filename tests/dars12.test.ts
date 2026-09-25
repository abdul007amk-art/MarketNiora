const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs');
const {Dars12Engine,Dars12Store,addDecimalStrings,toCatalystCandidate}=require('../backend/src/dars12/dars12Engine.ts');

const base=(o={})=>({sourceEventId:'evt-1',source:'SOURCE_A',symbol:'AAA',value:'1.25',sourceTimestamp:100,effectiveTime:100,knowledgeTime:100,verificationStatus:'VERIFIED',dataNature:'RAW',formulaVersion:null,...o});
const sum=e=>addDecimalStrings(e.map(x=>x.value));
const idx=(r,s,st)=>r.stageEvents.findIndex(e=>e.stage===s&&e.status===st);

test('DARS12-001 Evidence Refresh precedes Formula Recalculation',()=>{
 const r=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.equal(r.formulaExecuted,true); assert.ok(idx(r,'EVIDENCE_REFRESH','SUCCEEDED')<idx(r,'FORMULA_RECALCULATION','STARTED'));
});
test('DARS12-002 stale evidence blocks formula recalculation',()=>{
 const e=new Dars12Engine(); e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const r=e.run({runKnowledgeTime:300,providerHealthy:true,rawEvents:[base({sourceEventId:'evt-2',symbol:'BBB'})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.equal(r.formulaExecuted,false); assert.equal(r.truthState,'STALE');
});
test('DARS12-003 refresh failure is isolated and prior canonical state is preserved',()=>{
 const s=new Dars12Store(), e=new Dars12Engine(s);
 e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const before=s.allEvidence();
 const r=e.run({runKnowledgeTime:300,providerHealthy:true,rawEvents:[base({sourceEventId:'evt-2',value:'9.99',knowledgeTime:300})],evidenceRefreshSucceeded:false,formulaVersion:'F1',formula:sum});
 assert.equal(r.formulaExecuted,false); assert.ok(idx(r,'EVIDENCE_REFRESH','FAILED')>=0); assert.deepEqual(s.allEvidence(),before);
});
test('DARS12-004 source_event_id replay is idempotent',()=>{
 const s=new Dars12Store(), e=new Dars12Engine(s), input={runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum};
 const a=e.run(input), b=e.run({...input,runKnowledgeTime:300}); assert.equal(a.formulaOutput,b.formulaOutput); assert.equal(s.allEvidence().length,1); assert.deepEqual(b.duplicateSourceEventIds,['evt-1']);
});
test('DARS12-005 DARS-1.2 does not import protected engines or receive imports from them',()=>{
 const src=fs.readFileSync(require.resolve('../backend/src/dars12/dars12Engine.ts'),'utf8');
 const rot=fs.readFileSync(require.resolve('../backend/src/protected/rotationEngine.ts'),'utf8');
 const score=fs.readFileSync(require.resolve('../backend/src/protected/stockScoreEngine.ts'),'utf8');
 assert.equal(/^\s*import\b.*protected\\//m.test(src),false); assert.equal(/^\s*import\b.*dars12/m.test(rot),false); assert.equal(/^\s*import\b.*dars12/m.test(score),false);
});
test('DARS12-006 point-in-time reconstruction uses knowledge_time cutoff',()=>{
 const s=new Dars12Store(), e=new Dars12Engine(s);
 e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({value:'1.25',knowledgeTime:100})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 e.run({runKnowledgeTime:300,providerHealthy:true,rawEvents:[base({sourceEventId:'evt-2',value:'2.50',knowledgeTime:300})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const early=s.reconstruct(250), late=s.reconstruct(350);
 assert.equal(early.some(x=>x.value==='2.50'),false); assert.equal(early.some(x=>x.value==='1.25'),true);
 assert.equal(late.some(x=>x.value==='2.50'),true); assert.equal(early.find(x=>x.value==='1.25').effectiveTime,100);
});
test('DARS12-007 provenance fields and source_event_id are retained',()=>{
 const r=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({origin:'OCE'})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum}), e=r.evidence[0];
 assert.equal(e.sourceEventId,'evt-1'); assert.equal(e.source,'SOURCE_A'); assert.equal(e.sourceTimestamp,100); assert.equal(e.effectiveTime,100); assert.equal(e.knowledgeTime,100); assert.equal(e.verificationStatus,'VERIFIED'); assert.equal(e.dataNature,'RAW'); assert.equal(e.formulaVersion,null);
});
test('DARS12-008 identical state is deterministic',()=>{
 const ev=[base({sourceEventId:'evt-2',symbol:'BBB',value:'2.10'}),base({sourceEventId:'evt-1',symbol:'AAA',value:'1.20'})];
 const a=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:ev,evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const b=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[...ev].reverse(),evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.equal(a.formulaOutput,'3.3'); assert.equal(a.formulaOutput,b.formulaOutput); assert.deepEqual(a.evidence.map(e=>e.evidenceKey),b.evidence.map(e=>e.evidenceKey));
});
test('D12 precision uses fixed-point decimal arithmetic',()=>{assert.equal(addDecimalStrings(['0.1','0.2']),'0.3');assert.equal(addDecimalStrings(['999999999.123456','0.876544']),'1000000000');});
test('OCE to Catalyst boundary emits only a reviewable candidate',()=>{
 const r=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({origin:'OCE'})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const c=toCatalystCandidate(r.evidence[0]); assert.deepEqual(c,{sourceEventId:'evt-1',evidenceKey:'evt-1|SOURCE_A|AAA',requiresReview:true}); assert.equal(Object.hasOwn(c,'catalyst'),false);
});

test('DARS12 adversarial: same source_event_id with conflicting payload cannot overwrite canonical evidence',()=>{
 const s=new Dars12Store(), e=new Dars12Engine(s);
 e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base()],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 const r=e.run({runKnowledgeTime:300,providerHealthy:true,rawEvents:[base({value:'99.99',knowledgeTime:300})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.deepEqual(r.duplicateSourceEventIds,['evt-1']);
 assert.equal(s.allEvidence()[0].value,'1.25');
});
test('DARS12 adversarial: derived evidence cannot claim a different formula version',()=>{
 const r=new Dars12Engine().run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({dataNature:'DERIVED',formulaVersion:'F0'})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.equal(r.formulaExecuted,false); assert.equal(r.truthState,'BLOCKED');
});

test('DARS12 adversarial: conflicting duplicate source_event_id inside one batch is rejected atomically',()=>{
 const s=new Dars12Store(), e=new Dars12Engine(s);
 const r=e.run({runKnowledgeTime:200,providerHealthy:true,rawEvents:[base({value:'1.25'}),base({value:'9.99'})],evidenceRefreshSucceeded:true,formulaVersion:'F1',formula:sum});
 assert.deepEqual(r.duplicateSourceEventIds,['evt-1']);
 assert.equal(r.formulaExecuted,false);
 assert.equal(r.truthState,'BLOCKED');
 assert.match(r.errors[0],/conflicting source_event_id values within input batch rejected/);
 assert.equal(s.allEvidence().length,0);
});
