import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Preview role switching is disabled. Staff must sign in with their facility username and password.' },
    { status: 403 }
  );
}
