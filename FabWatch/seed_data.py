#!/usr/bin/env python3
"""
FabWatch — Manual Data Seed Script
Run from: /home/rogersr/fabwatch
Usage:    python3 seed_data.py
"""

import sqlite3
import json
from datetime import datetime

DB_PATH = "data.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

def existing_names(table):
    cur.execute(f"SELECT name FROM {table}")
    return {r[0] for r in cur.fetchall()}

def insert_listing(d):
    cur.execute("""
        INSERT INTO listings
          (name, broker, status, type, wafer_sizes, square_footage,
           power_capacity_mw, state, city, lat, lng, asking_price,
           nodes, seller, listed_date, notes, source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        d["name"], d["broker"], d["status"], d["type"],
        json.dumps(d.get("wafer_sizes", [])),
        d.get("square_footage"), d.get("power_capacity_mw"),
        d["state"], d["city"], d.get("lat"), d.get("lng"),
        d.get("asking_price"),
        json.dumps(d.get("nodes", [])),
        d.get("seller"), d.get("listed_date"),
        d.get("notes"), d.get("source_url")
    ))

def insert_expansion(d):
    cur.execute("""
        INSERT INTO expansions
          (name, company, state, city, lat, lng, type,
           investment_billions, wafer_size, completion_year,
           status, notes, source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        d["name"], d["company"], d["state"], d["city"],
        d.get("lat"), d.get("lng"), d["type"],
        d.get("investment_billions"), d.get("wafer_size"),
        d.get("completion_year"), d["status"],
        d.get("notes"), d.get("source_url")
    ))

LISTINGS = [
  {"name":"Wolfspeed Farmers Branch Epitaxy Campus","broker":"LoopNet / Direct","status":"active","type":"fab","wafer_sizes":["150mm"],"square_footage":457000,"power_capacity_mw":14,"state":"TX","city":"Farmers Branch","lat":32.926,"lng":-96.889,"asking_price":"Undisclosed","nodes":["SiC Epitaxy","GaN","150mm"],"seller":"Wolfspeed","listed_date":"2025-01","notes":"4-building campus on 26 acres. Bldg A is 162,500 sf fab. Bldg G is 14MW data center expandable to 28MW. Post-Chapter 11 bankruptcy disposition.","source_url":"https://www.datacenterdynamics.com/en/news/chipmaker-wolfspeed-closes-texas-site-puts-up-for-sale/"},
  {"name":"Wolfspeed Durham 150mm Device Fab","broker":"ATREG / Direct","status":"active","type":"fab","wafer_sizes":["150mm"],"square_footage":120000,"power_capacity_mw":8,"state":"NC","city":"Durham","lat":35.994,"lng":-78.899,"asking_price":"Undisclosed","nodes":["SiC","GaN","150mm Power"],"seller":"Wolfspeed","listed_date":"2025-H2","notes":"Shut down late 2025. Full 150mm SiC device production line. Part of Wolfspeed Chapter 11 restructuring. Apollo Global management.","source_url":"https://assets.wolfspeed.com/uploads/2026/02/Wolfspeed_Q2_2026_Earnings_Release.pdf"},
  {"name":"150mm Wafer Foundry — San Jose (Moov Technologies)","broker":"Moov Technologies","status":"active","type":"fab","wafer_sizes":["150mm","100mm"],"square_footage":5998,"power_capacity_mw":1.2,"state":"CA","city":"San Jose","lat":37.378,"lng":-121.929,"asking_price":"Contact Broker","nodes":["Bipolar","BiCMOS","MEMS","RF ICs","GaN-capable"],"seller":"WaferFoundry.co","listed_date":"2025","notes":"5,998 sf at 2108 Bering Dr. Full 150mm/100mm foundry ~10k wafer/yr. Class 100 + Class 1000 cleanrooms. For sale or lease including equipment.","source_url":"https://site.moov.co/hubfs/Moov_FabSaleBrochure_v3_English.pdf"},
  {"name":"ATREG 200mm/300mm Fab Portfolio — Q3 2026","broker":"ATREG Inc.","status":"active","type":"cleanroom","wafer_sizes":["200mm","300mm"],"square_footage":None,"power_capacity_mw":None,"state":"US","city":"Multiple Locations","lat":39.5,"lng":-98.35,"asking_price":"Varies by asset","nodes":["200mm","300mm","Mixed process"],"seller":"Multiple Clients","listed_date":"2026-Q3","notes":"ATREG Q1 2026 newsletter: diverse portfolio of 200mm and 300mm fabs and cleanrooms across Western Hemisphere. Includes NDA-protected compound semi fab (GaAs/InP/GaN/SiC, listed since Sept 2024).","source_url":"https://atreg.com/newsletters/atreg-fab-disposition-newsletter-and-semi-update-q1-2026/"},
  {"name":"ATREG NDA Compound Semiconductor Fab — US","broker":"ATREG Inc.","status":"active","type":"compound_semi","wafer_sizes":["150mm","200mm"],"square_footage":None,"power_capacity_mw":None,"state":"US","city":"Location Withheld","lat":None,"lng":None,"asking_price":"Undisclosed — NDA Required","nodes":["GaAs","InP","GaN RF","SiC Power","AESA Radar T/R"],"seller":"Confidential","listed_date":"2024-09","notes":"NDA-protected listing since September 2024, still available Q3 2026. GaAs/InP/GaN/SiC compound semi fab. Likely ITAR-registered given defense/satcom process families. Potential: MACOM, Coherent, Qorvo, BAE Systems, Northrop Grumman.","source_url":"https://atreg.com/properties"},
  {"name":"Microchip Technology Tempe Fab 2","broker":"Macquarie Group","status":"active","type":"fab","wafer_sizes":["200mm"],"square_footage":None,"power_capacity_mw":None,"state":"AZ","city":"Tempe","lat":33.415,"lng":-111.935,"asking_price":"Undisclosed","nodes":["Legacy MCU","µm-class CMOS","200mm"],"seller":"Microchip Technology","listed_date":"2025-09","notes":"Closed ~September 2025. ~330 employees laid off. Macquarie Group brokering. Saved Microchip ~$90M/year. Near Motorola 52nd St Superfund site — environmental DD required. Equipment may be partially relocated to Gresham OR / Colorado Springs CO.","source_url":"https://www.microchip.com"},
  {"name":"LA Semiconductor Pocatello 200mm Fab — Equipment Auction","broker":"FTI Consulting / Macquarie S&T","status":"watch","type":"fab","wafer_sizes":["200mm"],"square_footage":57000,"power_capacity_mw":12,"state":"ID","city":"Pocatello","lat":42.865,"lng":-112.452,"asking_price":"Equipment auction in progress","nodes":["Analog CMOS","BCD","MOSFET","MEMS","BiCMOS","0.13µm–1.5µm"],"seller":"LA Semiconductor / FTI Receiver","listed_date":"2026-09","notes":"Social media reports Sept 2026: facility closed, equipment being sold off. WARN Act filed Feb 9 2026 for ~342 employees. Case 5:24-cv-02215 N.D. Ohio. Macquarie Equipment Capital $174M+ judgment. 31-acre campus, 554K sf building, 57K sf cleanroom (1997). ITAR-registered. Former AMI/onsemi facility since 1970. Building and cleanroom infrastructure retain value post-equipment-sale.","source_url":"https://www.courtlistener.com/docket/68649684/"},
  {"name":"REC Silicon Moses Lake Polysilicon Plant","broker":"Direct / TBD","status":"watch","type":"polysilicon","wafer_sizes":[],"square_footage":None,"power_capacity_mw":65,"state":"WA","city":"Moses Lake","lat":47.130,"lng":-119.278,"asking_price":"Undisclosed","nodes":["Polysilicon FBR","Electronic-grade Si","Solar-grade Si"],"seller":"REC Silicon ASA","listed_date":"2025","notes":"REC Silicon ASA (Oslo: RECSI). ~18-20k MT/year FBR process. Hanwha Solutions ~28-30% shareholder with offtake agreement. IRA Section 45X: $3/kg production credit. Restart from 2019 idling troubled by technical issues. Norwegian-owned — CFIUS consideration. Potential acquisition value ~$400-800M.","source_url":"https://www.recsiliconmoseslake.com"},
  {"name":"REC Silicon Butte Silane Gas Plant","broker":"Direct / TBD","status":"watch","type":"polysilicon","wafer_sizes":[],"square_footage":280000,"power_capacity_mw":18,"state":"MT","city":"Butte","lat":46.003,"lng":-112.535,"asking_price":"Undisclosed","nodes":["Polysilicon","Silane Gas","Solar-grade Si"],"seller":"REC Silicon ASA","listed_date":"2025","notes":"Norwegian firm mulling sale after US-China trade war disruption. One of three US polysilicon producers alongside Hemlock MI and Wacker Charleston TN.","source_url":"https://www.pv-tech.org/snarled-in-the-trade-war-rec-silicon-mulls-sale-of-us-plant/"},
  {"name":"Wolfspeed Mohawk Valley 200mm SiC Fab","broker":"Apollo Global / Direct","status":"watch","type":"fab","wafer_sizes":["200mm"],"square_footage":200000,"power_capacity_mw":40,"state":"NY","city":"Marcy","lat":43.164,"lng":-75.245,"asking_price":"N/A — Restructuring","nodes":["SiC MOSFET","200mm","Automotive-qualified"],"seller":"Wolfspeed / Apollo Global","listed_date":"2025-09","notes":"$1.2B joint investment with NY State. World's first 200mm SiC power device fab. Post-Chapter 11, Apollo Global acquired majority. CHIPS Act $750M preliminary award in question.","source_url":"https://elevenflo.com/blog/wolfspeed-bankruptcy-46b-debt-restructuring"},
  {"name":"Hanwha Polysilicon Facility — US Exit","broker":"Direct","status":"watch","type":"polysilicon","wafer_sizes":[],"square_footage":150000,"power_capacity_mw":12,"state":"GA","city":"Cartersville","lat":34.165,"lng":-84.799,"asking_price":"TBD","nodes":["Polysilicon","Solar-grade Si"],"seller":"Hanwha Solutions","listed_date":"2025-01","notes":"Hanwha announced exit from US polysilicon manufacturing January 2025 amid trade war disruption and cost pressures.","source_url":"https://www.kedglobal.com/energy/newsView/ked202501030006"},
  {"name":"Marcy Nanocenter — Greenfield Fab Site","broker":"ATREG / SUNY Poly","status":"active","type":"r_and_d","wafer_sizes":["200mm","300mm"],"square_footage":500000,"power_capacity_mw":50,"state":"NY","city":"Marcy","lat":43.165,"lng":-75.246,"asking_price":"Incentives Available","nodes":["Greenfield","Shovel-ready","Advanced Manufacturing"],"seller":"NY State / SUNY Poly","listed_date":"2025-Q1","notes":"Described by ATREG as most shovel-ready greenfield fab site in the US (Q1 2025). Adjacent to Wolfspeed Mohawk Valley 200mm SiC fab.","source_url":"https://atreg.com/newsletters/"},
]

EXPANSIONS = [
  {"name":"TSMC Arizona Gigafab Complex","company":"TSMC","state":"AZ","city":"Phoenix","lat":33.677,"lng":-112.108,"type":"logic","investment_billions":165,"wafer_size":"300mm","completion_year":2030,"status":"under_construction","notes":"12-fab long-term cluster. Fab 1 (N4P) operational at 88-92% yield. $165B total committed March 2025. CHIPS Act $6.6B direct + $5B loans.","source_url":"https://business.times-online.com/times-online/article/tokenring-2026-1-28-silicon-sovereignty-tsmcs-165-billion-arizona-gigafab-redefines-the-ai-global-order"},
  {"name":"Intel Ohio One — Fab 52/62","company":"Intel","state":"OH","city":"New Albany","lat":40.081,"lng":-82.792,"type":"logic","investment_billions":28,"wafer_size":"300mm","completion_year":2027,"status":"under_construction","notes":"Intel 18A and 14A process nodes. CHIPS Act $8.5B direct funding. Two fabs on 1,000-acre campus.","source_url":"https://www.intel.com/content/www/us/en/newsroom/news/intel-ohio.html"},
  {"name":"Intel Chandler Fab 52/62 — Arizona","company":"Intel","state":"AZ","city":"Chandler","lat":33.302,"lng":-111.841,"type":"logic","investment_billions":20,"wafer_size":"300mm","completion_year":2027,"status":"under_construction","notes":"Intel 18A process node. Part of $20B Arizona investment alongside existing Chandler campus.","source_url":"https://www.intel.com/content/www/us/en/newsroom/news/intel-fab-arizona.html"},
  {"name":"Samsung Taylor Fab — Texas","company":"Samsung","state":"TX","city":"Taylor","lat":30.571,"lng":-97.409,"type":"logic","investment_billions":17,"wafer_size":"300mm","completion_year":2026,"status":"under_construction","notes":"4nm and below. CHIPS Act $6.4B grant. 1,200-acre campus. Second fab (2nm) planned.","source_url":"https://semiconductor.samsung.com/us/us-operations/"},
  {"name":"Micron Boise DRAM Fab Expansion","company":"Micron Technology","state":"ID","city":"Boise","lat":43.615,"lng":-116.202,"type":"memory","investment_billions":15,"wafer_size":"300mm","completion_year":2030,"status":"under_construction","notes":"CHIPS Act supported. Part of $50B+ national expansion. Largest semiconductor project in Idaho history.","source_url":"https://www.industrialinfo.com/news/article/semiconductors-propel-idaho-to-27-billion-worth-of-under-construction-projects--342065"},
  {"name":"Micron Clay NY DRAM Fab","company":"Micron Technology","state":"NY","city":"Clay","lat":43.181,"lng":-76.204,"type":"memory","investment_billions":100,"wafer_size":"300mm","completion_year":2032,"status":"planned","notes":"Up to $100B over 20 years. CHIPS Act $6.1B. Will be largest semiconductor fab campus in US history.","source_url":"https://www.micron.com/about/us-manufacturing"},
  {"name":"Wolfspeed Siler City SiC Materials Factory","company":"Wolfspeed / Apollo Global","state":"NC","city":"Siler City","lat":35.724,"lng":-79.462,"type":"sic","investment_billions":1.5,"wafer_size":"200mm","completion_year":2025,"status":"operational","notes":"World's largest 200mm SiC materials factory. Now under Apollo Global management post-Chapter 11.","source_url":"https://elevenflo.com/blog/wolfspeed-bankruptcy-46b-debt-restructuring"},
  {"name":"Bosch Roseville SiC Fab (ex-TSI Semiconductors)","company":"Bosch","state":"CA","city":"Roseville","lat":38.752,"lng":-121.288,"type":"sic","investment_billions":1.5,"wafer_size":"200mm","completion_year":2026,"status":"under_construction","notes":"Acquired from TSI Semiconductors via ATREG. Retooling for 200mm SiC. CHIPS Act $225M PMT grant. First US Bosch semiconductor fab.","source_url":"https://www.businesswire.com/news/home/20230426005913/en/ATREG-Successfully-Advises-TSI-Semiconductors"},
  {"name":"onsemi East Fishkill SiC Fab","company":"onsemi","state":"NY","city":"East Fishkill","lat":41.536,"lng":-73.902,"type":"sic","investment_billions":2,"wafer_size":"300mm","completion_year":2027,"status":"under_construction","notes":"Former GlobalFoundries fab. Transitioning to 300mm SiC for EV and industrial power. Part of onsemi fab-right strategy.","source_url":"https://www.onsemi.com"},
  {"name":"Polar Semiconductor Bloomington Expansion","company":"Polar Semiconductor / Niobrara Capital","state":"MN","city":"Bloomington","lat":44.840,"lng":-93.394,"type":"analog_power","investment_billions":0.6,"wafer_size":"200mm","completion_year":2026,"status":"under_construction","notes":"CHIPS Act $120M (Sept 2024). Recapitalized by Niobrara Capital + Prudential Financial — majority US ownership. 200mm analog and power. Closest comparable to Pocatello cooperative model.","source_url":"https://www.commerce.gov/news/press-releases/2024/09/biden-harris-administration-announces-120-million-chips-act-funding"},
  {"name":"Texas Instruments Richardson 300mm Analog Fab","company":"Texas Instruments","state":"TX","city":"Richardson","lat":32.948,"lng":-96.729,"type":"analog_power","investment_billions":3.5,"wafer_size":"300mm","completion_year":2026,"status":"under_construction","notes":"Part of TI $30B+ US expansion. Moving analog from 200mm to 300mm to reduce cost per chip.","source_url":"https://www.ti.com/about-ti/company/ti-at-a-glance.html"},
  {"name":"SkyWater Technology Bloomington — DoD Expansion","company":"SkyWater Technology","state":"MN","city":"Bloomington","lat":44.840,"lng":-93.394,"type":"analog_power","investment_billions":0.108,"wafer_size":"200mm","completion_year":2026,"status":"under_construction","notes":"CHIPS Act $108M. DMEA Category 1A Trusted Foundry. Open-source SKY130 PDK. Acquired Infineon Austin Fab 25 (200mm) Nov 2024. Technology-as-a-Service model — closest US cooperative foundry analog to NAFA concept.","source_url":"https://investors.skywatertechnology.com"},
  {"name":"Amkor Technology Arizona Advanced Packaging","company":"Amkor Technology","state":"AZ","city":"Peoria","lat":33.580,"lng":-112.237,"type":"advanced_packaging","investment_billions":2,"wafer_size":"300mm","completion_year":2026,"status":"under_construction","notes":"CHIPS Act $400M. First US advanced packaging facility for Amkor. Serves Apple and TSMC ecosystem.","source_url":"https://www.amkor.com"},
  {"name":"GlobalWafers Sherman TX 300mm Wafer Fab","company":"GlobalWafers","state":"TX","city":"Sherman","lat":33.635,"lng":-96.609,"type":"polysilicon","investment_billions":5,"wafer_size":"300mm","completion_year":2027,"status":"under_construction","notes":"CHIPS Act $400M. Taiwanese-owned. Only large-scale US silicon wafer manufacturing investment in decades. Critical missing link: polysilicon → ingot → wafer → fab supply chain.","source_url":"https://www.globalwafers.com"},
  {"name":"TOYO US Polysilicon Supply Partnership","company":"TOYO / US Partner","state":"TX","city":"TBD","lat":31.0,"lng":-99.0,"type":"polysilicon","investment_billions":0.5,"wafer_size":None,"completion_year":2027,"status":"planned","notes":"TOYO secured strategic US polysilicon supply partnership January 2026. Addresses IRA domestic content polysilicon gap.","source_url":"https://www.nasdaq.com/press-release/toyo-secures-strategic-polysilicon-supply-us-polysilicon-manufacturer-2026-01-07"},
]

def main():
    existing_l = existing_names("listings")
    existing_e = existing_names("expansions")
    new_l = skipped_l = new_e = skipped_e = 0
    for d in LISTINGS:
        if d["name"] in existing_l: skipped_l += 1; continue
        insert_listing(d); print(f"  + listing:   {d['name']}"); new_l += 1
    for d in EXPANSIONS:
        if d["name"] in existing_e: skipped_e += 1; continue
        insert_expansion(d); print(f"  + expansion: {d['name']}"); new_e += 1
    conn.commit(); conn.close()
    print(f"\n✓ Done — +{new_l} listings ({skipped_l} skipped), +{new_e} expansions ({skipped_e} skipped)")

if __name__ == "__main__":
    main()
