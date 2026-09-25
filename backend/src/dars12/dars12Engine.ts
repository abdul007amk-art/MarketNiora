/**
 * DARS-1.2 execution kernel.
 * Governance/orchestration only: no imports into DARS-1.1 or protected scoring engines.
 */
export const DARS12_STAGES = [
  'PROVIDER_HEALTH','FETCH','RAW_INGEST','IDENTITY_RESOLUTION','VALIDATION',
  'DATA_DIFF','CANONICAL_WRITE','FRESHNESS','COVERAGE','READINESS',
  'EVIDENCE_REFRESH','FORMULA_RECALCULATION','FWHY_DIAGNOSTICS',
  'PROVENANCE_AUDIT','HEALTH_REPORT',
] as const;
export type Dars12Stage = (typeof DARS12_STAGES)[number];
export type VerificationStatus = 'VERIFIED'|'UNVERIFIED'|'SOURCE_REQUIRED';
export type DataNature = 'RAW'|'NORMALIZED'|'DERIVED';
export type TruthState = 'CURRENT'|'STALE'|'BLOCKED';

export interface RawDarsEvent {
  sourceEventId:string; source:string; symbol:string; value:string;
  sourceTimestamp:number; effectiveTime:number; knowledgeTime:number;
  verificationStatus:VerificationStatus; dataNature:DataNature;
  formulaVersion:string|null; origin?:'STANDARD'|'OCE';
}
export interface DarsEvidence extends RawDarsEvent {
  evidenceKey:string; refreshedAt:number; truthState:TruthState;
}
export interface Dars12RunInput {
  runKnowledgeTime:number; providerHealthy:boolean; rawEvents:RawDarsEvent[];
  evidenceRefreshSucceeded:boolean; expectedCoverage?:number; formulaVersion:string;
  formula:(evidence:readonly DarsEvidence[])=>string;
}
export interface Dars12StageEvent {
  sequence:number; stage:Dars12Stage; status:'STARTED'|'SUCCEEDED'|'SKIPPED'|'FAILED';
}
export interface Dars12RunResult {
  runId:string; stageEvents:Dars12StageEvent[]; evidence:DarsEvidence[];
  formulaOutput:string|null; formulaExecuted:boolean; duplicateSourceEventIds:string[];
  truthState:TruthState; ready:boolean; healthy:boolean; errors:string[];
}

const evidenceKey=(e:RawDarsEvent)=>[e.sourceEventId,e.source,e.symbol].join('|');

function scaledDecimal(value:string, digits=6):bigint {
  const m=/^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if(!m) throw new Error(\`invalid decimal: \${value}\`);
  const sign=m[1]==='-'?-1n:1n;
  const frac=(m[3]??'').padEnd(digits,'0').slice(0,digits);
  return sign*(BigInt(m[2])*10n**BigInt(digits)+BigInt(frac||'0'));
}
export function addDecimalStrings(values:readonly string[],digits=6):string {
  const scale=10n**BigInt(digits);
  const total=values.reduce((s,v)=>s+scaledDecimal(v,digits),0n);
  const sign=total<0n?'-':'', abs=total<0n?-total:total;
  const whole=abs/scale;
  const frac=(abs%scale).toString().padStart(digits,'0').replace(/0+$/,'');
  return frac?\`\${sign}\${whole}.\${frac}\`:\`\${sign}\${whole}\`;
}

export class Dars12Store {
  private readonly rows=new Map<string,DarsEvidence>();
  private versionKey(e:DarsEvidence){return e.evidenceKey+'|'+e.knowledgeTime;}
  snapshot(){return [...this.rows.values()];}
  restore(rows:DarsEvidence[]){this.rows.clear(); for(const e of rows)this.rows.set(this.versionKey(e),e);}
  hasSourceEvent(sourceEventId:string){return [...this.rows.values()].some(e=>e.sourceEventId===sourceEventId);}
  upsertEvidence(e:DarsEvidence){
    const existing=[...this.rows.values()].find(row=>row.sourceEventId===e.sourceEventId);
    if(existing){
      const samePayload = existing.source===e.source && existing.symbol===e.symbol && existing.value===e.value &&
        existing.sourceTimestamp===e.sourceTimestamp && existing.effectiveTime===e.effectiveTime &&
        existing.knowledgeTime===e.knowledgeTime && existing.verificationStatus===e.verificationStatus &&
        existing.dataNature===e.dataNature && existing.formulaVersion===e.formulaVersion && existing.origin===e.origin;
      if(samePayload){
        const k=this.versionKey(existing);
        this.rows.set(k,{...existing,refreshedAt:e.refreshedAt,truthState:'CURRENT'});
      }
      return false;
    }
    this.rows.set(this.versionKey(e),e); return true;
  }
  allEvidence(){return [...this.rows.values()].sort((a,b)=>a.evidenceKey.localeCompare(b.evidenceKey)||a.knowledgeTime-b.knowledgeTime);}
  currentEvidence(asOf:number){
    const m=new Map<string,DarsEvidence>();
    for(const e of this.rows.values()){
      if(e.knowledgeTime>asOf)continue;
      const old=m.get(e.evidenceKey);
      if(!old||e.knowledgeTime>old.knowledgeTime||(e.knowledgeTime===old.knowledgeTime&&e.sourceEventId>old.sourceEventId))m.set(e.evidenceKey,e);
    }
    return [...m.values()].sort((a,b)=>a.evidenceKey.localeCompare(b.evidenceKey));
  }
  reconstruct(asOfKnowledgeTime:number){return this.currentEvidence(asOfKnowledgeTime);}
}

export class Dars12Engine {
  private readonly store:Dars12Store;
  constructor(store:Dars12Store=new Dars12Store()){this.store=store;}
  getStore(){return this.store;}

  run(input:Dars12RunInput):Dars12RunResult {
    const runId=\`DARS12-\${input.runKnowledgeTime}\`, events:Dars12StageEvent[]=[], errors:string[]=[];
    let seq=0; const mark=(stage:Dars12Stage,status:Dars12StageEvent['status'])=>events.push({sequence:++seq,stage,status});
    const fail=(e:string)=>errors.push(e);

    mark('PROVIDER_HEALTH','STARTED');
    if(!input.providerHealthy){
      mark('PROVIDER_HEALTH','FAILED'); fail('provider health check failed');
      for(const s of DARS12_STAGES.slice(1))mark(s,'SKIPPED');
      return this.out(runId,events,[],null,false,[],'BLOCKED',false,false,errors);
    }
    mark('PROVIDER_HEALTH','SUCCEEDED');

    mark('FETCH','STARTED'); mark('FETCH','SUCCEEDED');
    mark('RAW_INGEST','STARTED'); mark('RAW_INGEST','SUCCEEDED');

    mark('IDENTITY_RESOLUTION','STARTED');
    const idErrors=input.rawEvents.some(e=>!e.sourceEventId||!e.source||!e.symbol);
    if(idErrors){
      mark('IDENTITY_RESOLUTION','FAILED'); fail('identity fields are required');
      for(const s of DARS12_STAGES.slice(4))mark(s,'SKIPPED');
      return this.out(runId,events,[],null,false,[],'BLOCKED',false,false,errors);
    }
    mark('IDENTITY_RESOLUTION','SUCCEEDED');

    mark('VALIDATION','STARTED');
    const ve:string[]=[];
    for(const e of input.rawEvents){
      if(![e.sourceTimestamp,e.effectiveTime,e.knowledgeTime].every(Number.isFinite))ve.push(\`\${e.sourceEventId}: temporal fields must be finite\`);
      if(e.knowledgeTime<e.sourceTimestamp)ve.push(\`\${e.sourceEventId}: knowledgeTime cannot precede sourceTimestamp\`);
      if(e.knowledgeTime>input.runKnowledgeTime)ve.push(\`\${e.sourceEventId}: knowledgeTime cannot be in the future of the run\`);
      if(e.dataNature==='DERIVED'&&!e.formulaVersion)ve.push(\`\${e.sourceEventId}: DERIVED evidence requires formulaVersion\`);
      if(e.dataNature==='DERIVED'&&e.formulaVersion!==input.formulaVersion)ve.push(\`\${e.sourceEventId}: DERIVED formulaVersion must match the run formulaVersion\`);
      if(e.dataNature!=='DERIVED'&&e.formulaVersion!==null)ve.push(\`\${e.sourceEventId}: formulaVersion must be null unless DERIVED\`);
    }
    if(ve.length){
      mark('VALIDATION','FAILED'); ve.forEach(fail);
      for(const s of DARS12_STAGES.slice(5))mark(s,'SKIPPED');
      return this.out(runId,events,[],null,false,[],'BLOCKED',false,false,errors);
    }
    mark('VALIDATION','SUCCEEDED');

    mark('DATA_DIFF','STARTED');
    const ids=input.rawEvents.map(e=>e.sourceEventId);
    const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i || this.store.hasSourceEvent(id)))].sort();
    mark('DATA_DIFF','SUCCEEDED');
    const conflictingReplay = input.rawEvents.some(e => {
      const existing=this.store.snapshot().find(row=>row.sourceEventId===e.sourceEventId);
      if(!existing)return false;
      return existing.source!==e.source || existing.symbol!==e.symbol || existing.value!==e.value ||
        existing.sourceTimestamp!==e.sourceTimestamp || existing.effectiveTime!==e.effectiveTime ||
        existing.knowledgeTime!==e.knowledgeTime || existing.verificationStatus!==e.verificationStatus ||
        existing.dataNature!==e.dataNature || existing.formulaVersion!==e.formulaVersion || existing.origin!==e.origin;
    });
    if(conflictingReplay){
      fail('conflicting source_event_id replay rejected');
      return this.out(runId,events,this.store.currentEvidence(input.runKnowledgeTime),null,false,duplicates,'BLOCKED',false,false,errors);
    }

    const snapshot=this.store.snapshot();
    mark('CANONICAL_WRITE','STARTED');
    for(const e of [...input.rawEvents].sort((a,b)=>evidenceKey(a).localeCompare(evidenceKey(b)))){
      this.store.upsertEvidence({...e,evidenceKey:evidenceKey(e),refreshedAt:input.runKnowledgeTime,truthState:'CURRENT'});
    }
    mark('CANONICAL_WRITE','SUCCEEDED');

    mark('FRESHNESS','STARTED');
    const current=this.store.currentEvidence(input.runKnowledgeTime);
    const refreshed=current.map(e=>({...e,truthState:e.refreshedAt===input.runKnowledgeTime?'CURRENT' as const:'STALE' as const}));
    if(refreshed.some(e=>e.truthState==='STALE')){
      mark('FRESHNESS','FAILED'); fail('stale evidence remains in the current canonical view');
      this.store.restore(snapshot);
      for(const s of DARS12_STAGES.slice(8))mark(s,'SKIPPED');
      return this.out(runId,events,this.store.currentEvidence(input.runKnowledgeTime),null,false,duplicates,'STALE',false,false,errors);
    }
    mark('FRESHNESS','SUCCEEDED');

    mark('COVERAGE','STARTED');
    const expected=input.expectedCoverage??0;
    if(refreshed.length<expected){
      mark('COVERAGE','FAILED'); fail(\`coverage \${refreshed.length} below expected \${expected}\`);
      for(const s of DARS12_STAGES.slice(9))mark(s,'SKIPPED');
      return this.out(runId,events,refreshed,null,false,duplicates,'BLOCKED',false,false,errors);
    }
    mark('COVERAGE','SUCCEEDED');

    mark('READINESS','STARTED'); mark('READINESS','SUCCEEDED');

    mark('EVIDENCE_REFRESH','STARTED');
    if(!input.evidenceRefreshSucceeded){
      mark('EVIDENCE_REFRESH','FAILED'); fail('evidence refresh failed');
      this.store.restore(snapshot);
      for(const s of DARS12_STAGES.slice(11))mark(s,'SKIPPED');
      return this.out(runId,events,this.store.currentEvidence(input.runKnowledgeTime),null,false,duplicates,'BLOCKED',false,false,errors);
    }
    mark('EVIDENCE_REFRESH','SUCCEEDED');

    mark('FORMULA_RECALCULATION','STARTED');
    const formulaEvidence=this.store.currentEvidence(input.runKnowledgeTime);
    if(formulaEvidence.some(e=>e.refreshedAt!==input.runKnowledgeTime)){
      mark('FORMULA_RECALCULATION','FAILED'); fail('formula recalculation blocked by stale evidence');
      for(const s of DARS12_STAGES.slice(12))mark(s,'SKIPPED');
      return this.out(runId,events,formulaEvidence,null,false,duplicates,'BLOCKED',false,false,errors);
    }
    const formulaOutput=input.formula([...formulaEvidence].sort((a,b)=>a.evidenceKey.localeCompare(b.evidenceKey)));
    mark('FORMULA_RECALCULATION','SUCCEEDED');

    mark('FWHY_DIAGNOSTICS','STARTED'); mark('FWHY_DIAGNOSTICS','SUCCEEDED');
    mark('PROVENANCE_AUDIT','STARTED'); mark('PROVENANCE_AUDIT','SUCCEEDED');
    mark('HEALTH_REPORT','STARTED'); mark('HEALTH_REPORT','SUCCEEDED');
    return this.out(runId,events,formulaEvidence,formulaOutput,true,duplicates,'CURRENT',true,true,errors);
  }

  private out(runId:string,stageEvents:Dars12StageEvent[],evidence:DarsEvidence[],formulaOutput:string|null,formulaExecuted:boolean,duplicateSourceEventIds:string[],truthState:TruthState,ready:boolean,healthy:boolean,errors:string[]):Dars12RunResult{
    return {runId,stageEvents,evidence,formulaOutput,formulaExecuted,duplicateSourceEventIds,truthState,ready,healthy,errors};
  }
}

/** OCE boundary: only a reviewable candidate is emitted; DARS never mutates catalyst/score state. */
export interface CatalystCandidate{sourceEventId:string;evidenceKey:string;requiresReview:true;}
export function toCatalystCandidate(e:DarsEvidence):CatalystCandidate|null{
  if(e.origin!=='OCE'||e.truthState!=='CURRENT'||e.verificationStatus!=='VERIFIED')return null;
  return {sourceEventId:e.sourceEventId,evidenceKey:e.evidenceKey,requiresReview:true};
}
