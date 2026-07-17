/**
 * Google reviews shown on the homepage.
 *
 * ⚠️ SCAFFOLD DATA. To show REAL, live Google reviews, wire the Google Places
 * API (Place Details → `reviews` field) using the AutoModz Place ID + a Maps
 * API key, then map the response into this same shape. Keep only 5★ + recent.
 * Until then these placeholders keep the layout real. Replace, don't add to.
 *
 * Shape mirrors what Places returns: author_name, rating, text,
 * relative_time_description, profile_photo_url (we render an initial instead).
 */
export interface Review {
  name: string;
  rating: 5;
  text: string;
  when: string;
}

export const GOOGLE_RATING = { score: 4.9, count: 180 };

export const REVIEWS: Review[] = [
  { name: 'Rahul Mehta',   rating: 5, text: 'Got ceramic done on my X5. They tracked every stage on my phone and the car came back better than showroom day.', when: '2 weeks ago' },
  { name: 'Kunal Shah',    rating: 5, text: 'No pressure to buy the biggest package - they told me honestly what my Fortuner actually needed. Rare in Ahmedabad.', when: '1 month ago' },
  { name: 'Priya Desai',   rating: 5, text: 'PPF work is completely invisible. Two years on, still no swirls and water just rolls right off.', when: '3 weeks ago' },
  { name: 'Amit Patel',    rating: 5, text: 'Every panel photographed before and after. The transparency and finish quality is on another level.', when: '1 month ago' },
  { name: 'Sneha Joshi',   rating: 5, text: 'Booked in two minutes, dropped the car in Maninagar, picked it up glowing. Will only come here now.', when: '5 days ago' },
];
