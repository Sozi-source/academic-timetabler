import { redirect } from 'next/navigation';

// Results have been removed from the student portal.
// Students should contact the college administration for their results.
export default async function StudentResultsPage() {
  redirect('/student');
}
