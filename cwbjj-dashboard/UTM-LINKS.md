# Links for Instagram and Facebook

Use these links whenever you share the website. They tell the dashboard where each visitor came from, so you can see which posts and ads bring in trial bookings.

You don't need to type anything new. Copy the link that matches where you're posting.

## Everyday links

| Where you're posting | Link to use |
|---|---|
| Instagram bio | `https://canarywharfbjj.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio` |
| Instagram story (link sticker) | `https://canarywharfbjj.com/?utm_source=instagram&utm_medium=social&utm_campaign=story` |
| Facebook page (About, posts) | `https://canarywharfbjj.com/?utm_source=facebook&utm_medium=social` |

## Sending people straight to booking

Same idea, but they land on the booking page with the class already picked. Change the end of the link to the programme you're promoting.

| Programme | Link (Instagram story example) |
|---|---|
| Beginners | `https://canarywharfbjj.com/book?programme=adult-beginners&utm_source=instagram&utm_medium=social&utm_campaign=story` |
| Gi | `…/book?programme=gi&utm_source=instagram&utm_medium=social&utm_campaign=story` |
| No-Gi | `…/book?programme=no-gi&…` |
| Striking | `…/book?programme=adult-striking&…` |
| Kids 4 to 5 | `…/book?programme=kids-4-5&…` |
| Kids 6 to 11 | `…/book?programme=kids-6-11&…` |
| Teens 12 to 15 | `…/book?programme=teens-12-15&…` |

## Meta ads (Instagram and Facebook)

In Ads Manager, on each ad, find **URL parameters** (under Destination → Website URL → Build a URL parameter) and paste:

```
utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}
```

Meta fills in where the ad ran (`ig` for Instagram, `fb` for Facebook) and the campaign name for you. `utm_medium=paid` is what lets the dashboard show ads as their own rows ("Instagram ads", "Facebook ads").

If you'd rather set it by hand, use `utm_source=instagram` or `utm_source=facebook`, `utm_medium=paid`, and a short campaign name.

## The three parts

- `utm_source`: where it was posted. Use `instagram` or `facebook`.
- `utm_medium`: `social` for normal posts, `paid` for ads.
- `utm_campaign`: optional. A short name for a specific ad or promotion, for example `january-beginners`. Lowercase, no spaces.

Keep the spelling exactly the same every time, or the dashboard treats them as different sources.
