import {
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  cookies,
} from 'next/headers';

import {
  createAdminClient,
} from '@/lib/supabase/admin';

const COOKIE_NAME =
  'ams_student_session';

const SESSION_HOURS =
  12;

function tokenHash(
  token: string,
) {
  return createHash(
    'sha256',
  )
    .update(
      token,
    )
    .digest(
      'hex',
    );
}

export async function createStudentPortalSession(
  studentId: string,
) {
  const token =
    randomBytes(
      32,
    ).toString(
      'base64url',
    );

  const expiresAt =
    new Date(
      Date.now() +
        SESSION_HOURS *
          60 *
          60 *
          1000,
    );

  const admin =
    createAdminClient();

  await admin
    .from(
      'student_portal_sessions',
    )
    .update({
      revoked_at:
        new Date()
          .toISOString(),
    })
    .eq(
      'student_id',
      studentId,
    )
    .is(
      'revoked_at',
      null,
    );

  const {
    error,
  } =
    await admin
      .from(
        'student_portal_sessions',
      )
      .insert({
        student_id:
          studentId,
        token_hash:
          tokenHash(
            token,
          ),
        expires_at:
          expiresAt
            .toISOString(),
      });

  if (error) {
    throw new Error(
      `Unable to create student session: ${error.message}`,
    );
  }

  const store =
    await cookies();

  store.set(
    COOKIE_NAME,
    token,
    {
      httpOnly:
        true,
      sameSite:
        'lax',
      secure:
        process.env
          .NODE_ENV ===
        'production',
      path:
        '/',
      expires:
        expiresAt,
    },
  );
}

function safeDeleteCookie(
  store: Awaited<ReturnType<typeof cookies>>,
  name: string,
) {
  try {
    store.delete(name);
  } catch {
    /*
     * In Next.js Server Components, cookies cannot be mutated during render.
     * Ignore safely to prevent uncaught invariant crash (500 error boundary).
     */
  }
}

export async function getStudentPortalSession() {
  try {
    const store =
      await cookies();

    const token =
      store.get(
        COOKIE_NAME,
      )?.value;

    if (!token) {
      return null;
    }

    const admin =
      createAdminClient();

    const {
      data,
      error,
    } =
      await admin
        .from(
          'student_portal_sessions',
        )
        .select(
          'id, student_id, expires_at, revoked_at',
        )
        .eq(
          'token_hash',
          tokenHash(
            token,
          ),
        )
        .maybeSingle();

    if (
      error ||
      !data ||
      data.revoked_at ||
      new Date(
        data.expires_at,
      ).getTime() <=
        Date.now()
    ) {
      safeDeleteCookie(
        store,
        COOKIE_NAME,
      );
      return null;
    }

    const {
      data: student,
      error:
        studentError,
    } =
      await admin
        .from(
          'students',
        )
        .select(
          'id, lifecycle_status',
        )
        .eq(
          'id',
          data.student_id,
        )
        .maybeSingle();

    if (
      studentError ||
      !student ||
      ![
        'admitted',
        'active',
      ].includes(
        student.lifecycle_status,
      )
    ) {
      try {
        await admin
          .from(
            'student_portal_sessions',
          )
          .update({
            revoked_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            data.id,
          );
      } catch {
        // Ignore background session revocation failure
      }

      safeDeleteCookie(
        store,
        COOKIE_NAME,
      );

      return null;
    }

    try {
      await admin
        .from(
          'student_portal_sessions',
        )
        .update({
          last_seen_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          data.id,
        );
    } catch {
      // Ignore background timestamp update failure
    }

    return {
      id:
        data.id as
          string,
      studentId:
        data.student_id as
          string,
    };
  } catch (err) {
    console.error('getStudentPortalSession caught error, returning null safely:', err);
    return null;
  }
}

export async function revokeStudentPortalSession() {
  try {
    const store =
      await cookies();

    const token =
      store.get(
        COOKIE_NAME,
      )?.value;

    if (token) {
      const admin =
        createAdminClient();

      await admin
        .from(
          'student_portal_sessions',
        )
        .update({
          revoked_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'token_hash',
          tokenHash(
            token,
          ),
        );
    }

    safeDeleteCookie(
      store,
      COOKIE_NAME,
    );
  } catch (err) {
    console.error('revokeStudentPortalSession error:', err);
  }
}

