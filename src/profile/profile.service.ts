import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type ApplicantPayload = {
  rutNumber: number;
  rutDv: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  commune?: string;
  region?: string;
};

@Injectable()
export class ProfileService {
  constructor(private ds: DataSource) {}

  async ensureApplicant(userId: string, data: ApplicantPayload) {
    // Revisa si el user ya está vinculado
    const user = (await this.ds.query(
      `SELECT id, applicant_id FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    ))?.[0];
    if (!user) throw new BadRequestException('User not found');

    if (user.applicant_id) {
      // Actualiza datos básicos del applicant
      const res = await this.ds.query(
        `UPDATE applicants SET
           rut_number = $1,
           rut_dv = $2,
           first_name = $3,
           last_name = $4,
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           address = COALESCE($7, address),
           commune = COALESCE($8, commune),
           region = COALESCE($9, region),
           updated_at = NOW()
         WHERE id = $10
         RETURNING id`,
        [
          data.rutNumber,
          data.rutDv,
          data.firstName,
          data.lastName,
          data.email ?? null,
          data.phone ?? null,
          data.address ?? null,
          data.commune ?? null,
          data.region ?? null,
          user.applicant_id,
        ],
      );
      return { ok: true, applicantId: res[0].id, mode: 'updated' };
    }

    // Crea applicant nuevo (ojo: trigger valida RUT)
    const created = await this.ds.query(
      `INSERT INTO applicants
        (id, rut_number, rut_dv, first_name, last_name, email, phone, address, commune, region)
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        data.rutNumber,
        data.rutDv,
        data.firstName,
        data.lastName,
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.commune ?? null,
        data.region ?? null,
      ],
    );
    const applicantId = created[0].id;

    // Vincula en users
    await this.ds.query(
      `UPDATE users SET applicant_id = $1, updated_at = NOW() WHERE id = $2`,
      [applicantId, userId],
    );

    return { ok: true, applicantId, mode: 'created' };
  }
}
