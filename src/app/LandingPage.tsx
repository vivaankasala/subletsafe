import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  ShieldCheck,
  MessageCircle,
  Users,
  House,
  Check,
  MoveRight,
} from "lucide-react";
export function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pilot-label">
            <span />A NEW CHAPTER IN STUDENT HOUSING
          </div>
          <h1>
            Find your place.
            <br />
            <em>Find your people.</em>
          </h1>
          <p>
            New semester. New city. Same need to feel at home.
            <br className="desktop-break" /> Discover housing and roommates
            around your campus.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/housing">
              Find a space
              <ArrowUpRight size={18} />
            </Link>
            <Link className="button outline" to="/roommates">
              Meet your roommates
              <Users size={18} />
            </Link>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={17} />
            <span>Built for students. Starting in Michigan.</span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of a welcoming campus neighborhood"
          role="img"
        >
          <div className="art-sun" />
          <div className="art-cloud one" />
          <div className="art-cloud two" />
          <div className="art-hill" />
          <div className="building left-building">
            <span className="roof" />
            <div className="window-row">
              <i />
              <i />
            </div>
            <div className="window-row">
              <i />
              <i />
            </div>
            <div className="art-door" />
          </div>
          <div className="building middle-building">
            <div className="middle-roof" />
            <div className="window-row">
              <i />
              <i />
              <i />
            </div>
            <div className="window-row">
              <i />
              <i />
              <i />
            </div>
            <div className="middle-entry" />
          </div>
          <div className="building right-building">
            <span className="roof" />
            <div className="window-row">
              <i />
              <i />
            </div>
            <div className="window-row">
              <i />
              <i />
            </div>
            <div className="art-door" />
          </div>
          <div className="art-tree tree-one">
            <i />
            <span />
          </div>
          <div className="art-tree tree-two">
            <i />
            <span />
          </div>
          <div className="art-ground" />
          <div className="art-caption">
            <span className="mini-icon">
              <House size={20} />
            </span>
            <div>
              <strong>Somewhere you belong.</strong>
              <span>Your campus. Your next home.</span>
            </div>
            <span className="caption-check">
              <Check size={16} />
            </span>
          </div>
          <div className="art-location">
            <MapPin size={14} />
            Hello, Michigan.
          </div>
        </div>
      </section>
      <section className="campus-strip">
        <span>STARTING CLOSE TO HOME</span>
        <div>
          <span className="college-mark">M</span>
          <span>
            University of Michigan<small>Ann Arbor, MI</small>
          </span>
        </div>
        <div>
          <span className="college-mark state">S</span>
          <span>
            Michigan State University<small>East Lansing, MI</small>
          </span>
        </div>
        <span className="campus-status">
          <span />
          Invite pilot in preparation
        </span>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LESS SCROLLING. MORE SETTLING IN.</span>
            <h2>One search. Two ways to feel at home.</h2>
          </div>
          <p>
            Because the right space and the right people
            <br />
            make all the difference.
          </p>
        </div>
        <div className="path-cards">
          <Link className="path-card housing-path" to="/housing">
            <span className="path-icon">
              <House size={28} />
            </span>
            <div>
              <span className="eyebrow">01 / FIND A SPACE</span>
              <h3>
                Your next address
                <br />
                is out there.
              </h3>
              <p>
                Explore sublets, lease takeovers and open rooms by campus,
                budget and dates.
              </p>
              <span className="text-link">
                Explore housing
                <ArrowRight size={18} />
              </span>
            </div>
            <span className="path-corner">
              <ArrowUpRight size={22} />
            </span>
          </Link>
          <Link className="path-card people-path" to="/roommates">
            <span className="path-icon">
              <Users size={28} />
            </span>
            <div>
              <span className="eyebrow">02 / FIND YOUR PEOPLE</span>
              <h3>
                Roommates.
                <br />
                Maybe future friends.
              </h3>
              <p>
                Discover students with overlapping plans and living preferences.
                Start with a hello.
              </p>
              <span className="text-link">
                Meet potential roommates
                <ArrowRight size={18} />
              </span>
            </div>
            <span className="path-corner">
              <ArrowUpRight size={22} />
            </span>
          </Link>
        </div>
      </section>
      <section className="trust-section">
        <div>
          <span className="eyebrow">A LITTLE MORE PEACE OF MIND</span>
          <h2>
            Clear details.
            <br />
            Better conversations.
          </h2>
          <p>
            We’re building a more thoughtful way to navigate student housing,
            one campus at a time.
          </p>
          <Link className="text-link" to="/safety">
            How we approach safety
            <MoveRight size={18} />
          </Link>
        </div>
        <div className="trust-list">
          {[
            {
              icon: ShieldCheck,
              title: "Know what’s confirmed.",
              text: "University email confirmation is clearly labeled. It doesn’t verify identity or a property.",
            },
            {
              icon: MessageCircle,
              title: "Keep the conversation here.",
              text: "Private messages help you ask questions before sharing personal contact details.",
            },
            {
              icon: Users,
              title: "Your boundaries matter.",
              text: "Block and report tools give you control over who you connect with.",
            },
          ].map((x) => (
            <div key={x.title}>
              <span className="trust-icon">
                <x.icon size={23} />
              </span>
              <div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="closing-banner">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>Make yourself at home.</h2>
        </div>
        <Link className="button light" to="/auth?mode=signup">
          Join your campus community
          <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
