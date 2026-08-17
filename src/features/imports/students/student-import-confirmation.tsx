'use client';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { confirmStudentImportAction } from './actions';
import { initialStudentImportActionState } from './types';
export function StudentImportConfirmation({ batchId, validRows, invalidRows, duplicateRows, completed }: {batchId:string;validRows:number;invalidRows:number;duplicateRows:number;completed:boolean}) {
 const [state,formAction,pending]=useActionState(confirmStudentImportAction,initialStudentImportActionState);
 if(completed) return <section className="rounded-xl border border-success-border bg-success-surface p-4"><p className="text-sm font-semibold text-text-primary">Import completed</p><p className="mt-1 text-xs text-text-secondary">Valid students were added.</p></section>;
 return <section className="space-y-3 rounded-xl border border-border bg-surface p-4"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-text-muted">Ready</p><p className="text-xl font-bold text-text-primary">{validRows}</p></div><div><p className="text-xs text-text-muted">Invalid</p><p className="text-xl font-bold text-text-primary">{invalidRows}</p></div><div><p className="text-xs text-text-muted">Duplicates</p><p className="text-xl font-bold text-text-primary">{duplicateRows}</p></div></div>{state.message?<FormStatusMessage status={state.status==='success'?'success':'error'} message={state.message}/>:null}<form action={formAction} className="flex justify-end"><input type="hidden" name="batchId" value={batchId}/><Button type="submit" disabled={pending||validRows===0} leadingIcon={pending?<LoaderCircle className="size-4 animate-spin"/>:<ArrowRight className="size-4"/>}>{pending?'Importing in batches':`Import ${validRows} student${validRows===1?'':'s'}`}</Button></form></section>;
}
