import React from 'react';
import Instagram from '../../../components/Icons/Instagram';
import YouTube from '../../../components/Icons/YouTube';
import Twitter from '../../../components/Icons/Twitter';
import Facebook from '../../../components/Icons/Facebook';

export default function SocialLink ({
    type,
    link,
}) {
    return (
        <div className={`social-link social-link--${type}`}>
            <a href={link} target="_blank" className="social-link-anchor flex-aic jcc">
                { type === "instagram" && <Instagram height={18} width={18} fillColor="#002e52" /> }
                { type === "twitter" && <Twitter height={16} width={16} fillColor="#002e52" /> }
                { type === "youtube" && <YouTube height={18} width={18} fillColor="#002e52" /> }
                { type === "facebook" && <Facebook height={16} width={16} fillColor="#002e52" /> }
            </a>
        </div>
    );
};
