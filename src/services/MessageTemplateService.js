const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

function replaceVariables(template, variables) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return key in variables ? escapeHtml(String(variables[key])) : match;
  });
}

function rewriteLinksForClickTracking(html, campaignId, baseUrl) {
  // Replace all hrefs with click tracking URLs
  return html.replace(/href=["']([^"']+)["']/g, (match, url) => {
    // Only rewrite http/https links
    if (/^https?:\/\//i.test(url)) {
      const encodedUrl = encodeURIComponent(url);
      return `href=\"${baseUrl}/api/campaigns/track/click/${campaignId}?url=${encodedUrl}\"`;
    }
    return match;
  });
}

async function generateMessage(customer, campaign, options = {}) {
  // options.baseUrl is required for tracking URLs
  const baseUrl = options.baseUrl || 'http://localhost:5000';
  let body = campaign.content?.body || '';
  let subject = campaign.content?.subject || '';

  // Variable replacement
  const variables = {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    ...customer // allow any other customer fields
  };
  body = replaceVariables(body, variables);
  subject = replaceVariables(subject, variables);

  // Rewrite links for click tracking
  body = rewriteLinksForClickTracking(body, campaign._id, baseUrl);

  // Add open tracking pixel (at the end of the body)
  body += `<img src=\"${baseUrl}/api/campaigns/track/open/${campaign._id}\" width=\"1\" height=\"1\" style=\"display:none;\" alt=\"\" />`;

  return {
    subject,
    html: body
  };
}

module.exports = {
  generateMessage
}; 