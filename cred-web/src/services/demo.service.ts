import type { ReviewBlock } from '@/types/demo.types'
import { getSupabase } from './supabase.service'

const MOCK_DATA: ReviewBlock[] = [
  {
    id: '1',
    restaurant_name: 'bella-napoli',
    reviewer_name: 'Sarah M.',
    review_text:
      'The pasta was overcooked and the service was incredibly slow. We waited 45 minutes for our main course. Very disappointed for a restaurant at this price point.',
    rating: 2,
    response_a:
      "Dear Sarah, thank you for your honest feedback. We sincerely apologize for the long wait and the quality of your pasta. This is not the standard we hold ourselves to. We've spoken with our kitchen team to address these issues. We'd love the chance to make it right — please reach out to us directly for a complimentary meal.",
    response_b:
      "Hi Sarah, we're sorry to hear about your experience. A 45-minute wait is unacceptable, and we take full responsibility. We're implementing new timing protocols in our kitchen. We hope you'll give us another chance to show you the Bella Napoli experience you deserve.",
    response_c:
      "Sarah, thank you for letting us know. We dropped the ball on your visit, and we own that completely. Our chef has been briefed, and we're tightening our kitchen workflow. If you're open to it, we'd like to invite you back on us. Please DM us to arrange.",
  },
  {
    id: '2',
    restaurant_name: 'bella-napoli',
    reviewer_name: 'James K.',
    review_text:
      'Best Italian food in the city! The tiramisu alone is worth the trip. Staff was friendly and attentive. Will definitely come back.',
    rating: 5,
    response_a:
      "James, thank you so much! Our chef puts his heart into every tiramisu, and it means the world to hear you enjoyed it. We can't wait to welcome you back — next time, ask about our seasonal specials!",
    response_b:
      "Thank you, James! Reviews like yours make our day. We're thrilled the tiramisu lived up to expectations — it's our chef's pride and joy. See you again soon!",
    response_c:
      "James, we're so grateful for your kind words! Our team works hard to create a warm, welcoming experience, and it's wonderful to know it shows. We look forward to your next visit.",
  },
  {
    id: '3',
    restaurant_name: 'bella-napoli',
    reviewer_name: 'Linda R.',
    review_text:
      "Food was decent but nothing special. The ambiance is nice but it's overpriced for what you get. 3 stars because the bruschetta was actually good.",
    rating: 3,
    response_a:
      "Linda, thank you for your candid review. We're glad the bruschetta hit the mark! We understand value matters, and we're always working to ensure our menu delivers. We'd love to hear which dishes you'd like to see improved — your feedback helps us grow.",
    response_b:
      "Hi Linda, we appreciate your honesty. It sounds like we have room to improve on delivering consistent value. Our bruschetta is a fan favorite, and we want every dish to meet that standard. We hope to exceed your expectations next time.",
    response_c:
      "Thanks for the feedback, Linda. We hear you on the pricing concern and we're reviewing our menu to ensure every dish justifies its place. Glad the bruschetta stood out — we'll work to make the rest of the menu match.",
  },
  {
    id: '4',
    restaurant_name: 'bella-napoli',
    reviewer_name: 'Mike D.',
    review_text:
      "Had a great anniversary dinner here. The table by the window was perfect. Only minor issue — the wine list could use more variety. Otherwise, excellent evening.",
    rating: 4,
    response_a:
      "Mike, happy anniversary! We're thrilled you chose Bella Napoli for such a special occasion. Great note on the wine list — we're actually expanding our selection next month. Hope to see you for your next celebration!",
    response_b:
      "Thank you, Mike, and congratulations! Nothing makes us happier than being part of special moments. We've noted your wine feedback and are working with our sommelier to broaden the selection. Cheers!",
    response_c:
      "Mike, what a wonderful way to celebrate! Thank you for spending your anniversary with us. You'll be pleased to know we're revamping our wine list soon — more options coming your way. See you next time!",
  },
  {
    id: '5',
    restaurant_name: 'bella-napoli',
    reviewer_name: 'Priya S.',
    review_text:
      "Terrible experience. Found a hair in my soup and the manager didn't even apologize properly. Won't be returning. Save your money.",
    rating: 1,
    response_a:
      "Priya, we are deeply sorry. Finding a hair in your food is completely unacceptable, and you deserved a much better response from our manager. We've addressed this with our entire team. We'd like to make this right — please contact us directly so we can discuss how.",
    response_b:
      "Priya, this falls far below our standards, and we sincerely apologize. We've taken immediate steps: additional hygiene training for kitchen staff and a conversation with our manager about proper guest recovery. We understand if you're hesitant, but we'd welcome the opportunity to restore your trust.",
    response_c:
      "We owe you a genuine apology, Priya. No excuses — this shouldn't have happened, and our response should have been immediate and sincere. We've implemented new quality checks and retrained our front-of-house team. If you're ever willing to give us another shot, dinner is on us.",
  },
]

export async function getDemoBlocks(
  restaurantName: string
): Promise<ReviewBlock[]> {
  const supabase = getSupabase()

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('review_blocks')
        .select('*')
        .eq('restaurant_name', restaurantName)

      if (!error && data && data.length > 0) {
        return data as ReviewBlock[]
      }
    } catch {
      // Fall through to mock data
    }
  }

  // Fallback: return mock data
  return MOCK_DATA.map((block) => ({
    ...block,
    restaurant_name: restaurantName,
  }))
}

export async function getAllRestaurantNames(): Promise<string[]> {
  const supabase = getSupabase()

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('review_blocks')
        .select('restaurant_name')

      if (!error && data) {
        const names = [...new Set(data.map((r) => r.restaurant_name))]
        return names
      }
    } catch {
      // Fall through
    }
  }

  return ['bella-napoli']
}

export async function upsertReviewBlock(
  block: ReviewBlock
): Promise<ReviewBlock | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('review_blocks')
    .upsert(block)
    .select()
    .single()

  if (error) throw error
  return data as ReviewBlock
}

export async function deleteReviewBlock(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.from('review_blocks').delete().eq('id', id)

  if (error) throw error
}
