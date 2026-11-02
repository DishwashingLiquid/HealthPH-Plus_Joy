from html import escape
from urllib.parse import urlsplit
import os


def render_email(
    title,
    paragraphs,
    details=(),
    action_label=None,
    action_url=None,
):
    paragraphs = [str(paragraph) for paragraph in paragraphs]
    details = [
        (str(label), str(value))
        for label, value in details
    ]

    if bool(action_label) != bool(action_url):
        raise ValueError("Provide both an action label and URL.")

    if action_url:
        parsed_url = urlsplit(action_url)

        if (
            parsed_url.scheme not in {"http", "https"}
            or not parsed_url.netloc
        ):
            raise ValueError("Email links must use a valid HTTP or HTTPS URL.")

    support_email = os.getenv(
        "HEALTHPH_SUPPORT_EMAIL", ""
    ).strip()

    support_text = (
        f"Need help? Contact {support_email}."
        if support_email
        else "Need help? Contact your HealthPH+ administrator."
    )

    plain_parts = [
        "HealthPH+",
        str(title),
        *paragraphs,
    ]

    plain_parts.extend(
        f"{label}: {value}"
        for label, value in details
    )

    if action_url:
        plain_parts.append(f"{action_label}: {action_url}")

    plain_parts.extend([
        support_text,
        "This is an automated message from HealthPH+.",
    ])

    plain_text = "\n\n".join(plain_parts)

    paragraphs_html = "".join(
        '<p style="margin:0 0 16px;line-height:1.6;">'
        + escape(paragraph).replace("\n", "<br>")
        + "</p>"
        for paragraph in paragraphs
    )

    details_html = ""

    if details:
        rows = "".join(
            f"""
            <tr>
                <td 
                    style="padding:10px;border-bottom:1px solid #E5E5E5;
                        width:35%;vertical-align:top;color:#687582;"
                >
                    {escape(label)}
                </td>
                <td 
                    style="padding:10px;border-bottom:1px solid #E5E5E5;
                        vertical-align:top;word-break:break-word;"
                >
                    {escape(value)}
                </td>
            </tr>
            """
            for label, value in details
        )

        details_html = f"""
        <table
            role="presentation" width="100%" cellpadding="0"
                    cellspacing="0" style="margin:8px 0 24px;
                    border-collapse:collapse;font-size:14px;"
        >
            {rows}
        </table>
        """       

    action_html = ""

    if action_url:
        action_html = f"""
        <p style="margin:24px 0;">
            <a href="{escape(action_url, quote=True)}"
               style="display:inline-block;padding:12px 20px;
                      background-color:#32418C;color:#FFFFFF;
                      border-radius:8px;text-decoration:none;
                      font-weight:bold;">
                {escape(str(action_label))}
            </a>
        </p>
        """
    
    html = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{escape(str(title))}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F5F5F5;
                font-family:Arial,Helvetica,sans-serif;color:#333E4A;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center" style="padding:24px 12px;">
                    <table role="presentation" width="100%" cellpadding="0"
                        cellspacing="0" style="max-width:600px;
                        background-color:#FFFFFF;border:1px solid #E5E5E5;
                        border-radius:12px;">
                        <tr>
                            <td style="padding:24px;background-color:#32418C;
                                    color:#FFFFFF;font-size:24px;
                                    font-weight:bold;">
                                HealthPH+
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:24px;font-size:15px;">
                                <h1 style="margin:0 0 20px;font-size:22px;
                                        line-height:1.3;color:#333E4A;">
                                    {escape(str(title))}
                                </h1>
                                {paragraphs_html}
                                {details_html}
                                {action_html}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:20px 24px;
                                    border-top:1px solid #E5E5E5;
                                    color:#687582;font-size:12px;
                                    line-height:1.6;">
                                <p style="margin:0 0 8px;">
                                    {escape(support_text)}
                                </p>
                                <p style="margin:0;">
                                    This is an automated message from HealthPH+.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    return plain_text, html