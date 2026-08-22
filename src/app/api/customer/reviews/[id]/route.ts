import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// PUT /api/customer/reviews/[id]
// Update an existing review (rating and/or comment)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const { id } = await params;
    const reviewId = parseInt(id, 10);
    if (isNaN(reviewId) || reviewId <= 0) {
      return NextResponse.json({ error: 'Invalid review id' }, { status: 400 });
    }

    const body = await req.json();
    const rating = parseInt(body?.rating, 10);
    const comment = body?.comment?.toString()?.trim() || null;

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    // Verify the review belongs to this customer
    const reviews = await query<Array<{ 
      id: number; 
      partner_id: number;
      old_rating: number;
    }>>(
      `SELECT id, partner_id, rating as old_rating
       FROM reviews
       WHERE id = ? AND customer_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [reviewId, payload.userId]
    );

    if (reviews.length === 0) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const review = reviews[0];

    // Update the review
    await query(
      `UPDATE reviews
       SET rating = ?, comment = ?, updated_at = NOW()
       WHERE id = ?`,
      [rating, comment, reviewId]
    );

    // Recalculate partner rating if rating changed
    if (review.old_rating !== rating) {
      // Get all reviews for this partner
      const partnerReviews = await query<Array<{ rating: number }>>(
        `SELECT rating FROM reviews WHERE partner_id = ? AND deleted_at IS NULL`,
        [review.partner_id]
      );

      if (partnerReviews.length > 0) {
        const totalRating = partnerReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / partnerReviews.length;

        await query(
          `UPDATE partners
           SET rating = ROUND(?, 2), total_reviews = ?, updated_at = NOW()
           WHERE id = ?`,
          [avgRating, partnerReviews.length, review.partner_id]
        );
      }
    }

    return NextResponse.json({ success: true, rating, comment });
  } catch (err) {
    console.error('[reviews PUT] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/customer/reviews/[id]
// Soft delete a review
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const { id } = await params;
    const reviewId = parseInt(id, 10);
    if (isNaN(reviewId) || reviewId <= 0) {
      return NextResponse.json({ error: 'Invalid review id' }, { status: 400 });
    }

    // Verify the review belongs to this customer
    const reviews = await query<Array<{ 
      id: number; 
      partner_id: number;
      rating: number;
    }>>(
      `SELECT id, partner_id, rating
       FROM reviews
       WHERE id = ? AND customer_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [reviewId, payload.userId]
    );

    if (reviews.length === 0) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const review = reviews[0];

    // Soft delete the review
    await query(
      `UPDATE reviews SET deleted_at = NOW() WHERE id = ?`,
      [reviewId]
    );

    // Recalculate partner rating
    const partnerReviews = await query<Array<{ rating: number }>>(
      `SELECT rating FROM reviews WHERE partner_id = ? AND deleted_at IS NULL`,
      [review.partner_id]
    );

    if (partnerReviews.length > 0) {
      const totalRating = partnerReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / partnerReviews.length;

      await query(
        `UPDATE partners
         SET rating = ROUND(?, 2), total_reviews = ?, updated_at = NOW()
         WHERE id = ?`,
        [avgRating, partnerReviews.length, review.partner_id]
      );
    } else {
      // No reviews left, reset to null
      await query(
        `UPDATE partners
         SET rating = NULL, total_reviews = 0, updated_at = NOW()
         WHERE id = ?`,
        [review.partner_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reviews DELETE] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
