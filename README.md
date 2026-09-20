# 🧾 LifeReceipt — AI-Powered Digital Ownership Intelligence Platform

An AI-powered digital ownership intelligence platform that transforms **receipts, invoices, purchase emails, warranty documents, service records, and ownership information** into a structured and continuously evolving digital ownership record.

LifeReceipt helps users manage the complete lifecycle of the products they own — from the initial purchase to **warranty, returns, service, maintenance, expenses, ownership history, and transfer**.

Instead of treating a receipt as a simple document, LifeReceipt turns it into an **intelligent digital ownership record**.

---

## 🌐 Live Demo

🚀 **Try the application:**
[LifeReceipt](https://life-recipt.netlify.app/)

💻 **Source Code:**
[GitHub Repository](https://github.com/Thanesh16/LifeRecipt)

⚡ **Backend Health:**
[LifeReceipt API](https://liferecipt-production.up.railway.app/api/v1/health)

---

# 📌 Project Overview

Whenever a person purchases a product, important information gets distributed across different places.

For example:

```text
Purchase Receipt
      +
Invoice
      +
Email Confirmation
      +
Warranty Card
      +
Service Bills
      +
Maintenance Records
      +
Repair Expenses
      +
Product Documents
```

Over time, finding and managing this information becomes difficult.

LifeReceipt solves this problem by creating a **centralized digital ownership record** for every product.

A single product can contain:

```text
Product
│
├── Purchase Information
├── Seller Information
├── Purchase Price
├── Purchase Date
├── Warranty
├── Return Information
├── Documents
├── Service History
├── Maintenance History
├── Repair Costs
├── Ownership Timeline
└── Transfer Information
```

The platform combines **AI-powered document understanding, ownership management, Gmail intelligence, warranty tracking, service history, cost tracking, and an AI assistant** into one system.

---

# 🎯 Problem Statement

Managing purchased products after the transaction is often difficult.

## 1. Receipts are scattered

Purchase information may exist inside:

* Physical receipts
* PDF invoices
* Email confirmations
* Retailer websites
* Cloud storage
* Messaging applications
* Physical folders

Finding the correct document later can be difficult.

---

## 2. Warranty information is easily forgotten

Users may not remember:

* Purchase date
* Warranty duration
* Warranty expiry date
* Return deadline
* Warranty-related documents
* Service requirements

This can result in users missing important ownership information.

---

## 3. Service history is disconnected

Products may go through:

* Repairs
* Maintenance
* Part replacements
* Service-center visits
* Warranty claims

These events are usually stored separately instead of being maintained as one continuous history.

---

## 4. Ownership transfer is complicated

When a product is sold or transferred, the new owner may need:

* Purchase proof
* Warranty information
* Service history
* Product documents
* Ownership information

This information is often scattered across multiple files.

---

## 5. Purchase price is not the complete ownership cost

The initial purchase price does not represent the entire cost of owning a product.

For example:

```text
Purchase
   +
Repair
   +
Maintenance
   +
Replacement Parts
   +
Other Expenses
   =
Total Ownership Cost
```

Users generally do not have a simple way to track this lifecycle.

---

# 💡 Solution

LifeReceipt creates a **Digital Ownership Intelligence Layer** around every purchased product.

Instead of storing a receipt independently, LifeReceipt connects purchase information with the product's entire ownership lifecycle.

```text
Receipt / Invoice / Email
          │
          ▼
   AI Information Extraction
          │
          ▼
    Product Ownership Record
          │
     ┌────┼────┬────────┐
     │    │    │        │
     ▼    ▼    ▼        ▼
 Warranty Return Service Documents
     │    │    │        │
     └────┼────┼────────┘
          │
          ▼
   Ownership Timeline
          │
          ▼
    Cost & Analytics
          │
          ▼
     AI Assistant
```

The result is a single place where users can understand:

> **What do I own?
> When did I purchase it?
> How much did it cost?
> Is it under warranty?
> What services has it received?
> What documents belong to it?
> How much have I spent on it?
> What happened throughout its ownership lifecycle?**

---

# 📌 Objectives

The main objectives of LifeReceipt are:

* Convert unstructured purchase documents into structured ownership information.
* Automatically extract important purchase information using AI.
* Centralize product ownership records.
* Track warranty and return information.
* Maintain service and maintenance history.
* Track ownership-related expenses.
* Connect purchase information from Gmail.
* Provide an AI assistant for ownership-related questions.
* Maintain a chronological ownership timeline.
* Support digital ownership passports.
* Provide ownership transfer information.
* Keep document and source information traceable.
* Provide an India-first ownership experience using INR and Indian invoice formats.
* Provide a responsive and mobile-ready ownership management platform.

---

# ✨ Features

## 🧾 AI Receipt & Document Processing

Users can upload purchase-related documents such as:

* Receipts
* Invoices
* Warranty documents
* Service documents
* Ownership documents
* Other relevant purchase records

The AI processing pipeline extracts useful information from the uploaded document.

Typical information includes:

```text
Product Name
Brand
Model
Purchase Date
Purchase Price
Seller
Quantity
Invoice Number
Warranty Information
GST Information
Product Identifiers
```

The extracted information is then used to create or update the corresponding ownership record.

---

## 🤖 AI-Powered Information Extraction

LifeReceipt uses **Google Gemini** for document understanding and structured information extraction.

The AI processing pipeline follows:

```text
Uploaded Document
       ↓
Document Processing
       ↓
AI Analysis
       ↓
Information Extraction
       ↓
Structured Ownership Data
       ↓
Validation
       ↓
Product Record
```

The system is designed to avoid inventing information that is not present in the source document.

If a value is unavailable, it should remain unknown rather than being fabricated.

---

## 📦 Product Ownership Management

Each purchased product can become an individual ownership record.

The record can contain:

* Product name
* Brand
* Model
* Category
* Purchase date
* Purchase price
* Seller
* Quantity
* Warranty
* Return information
* Documents
* Service history
* Maintenance history
* Ownership timeline
* Cost information

This allows users to manage products throughout their entire ownership lifecycle.

---

## 🛡️ Warranty Management

LifeReceipt helps users organize warranty information associated with products.

Warranty information may include:

* Warranty duration
* Warranty start date
* Warranty expiry date
* Warranty status
* Warranty documents
* Manufacturer/service information

Warranty status can be represented as:

```text
🟢 Active
🟡 Expiring Soon
🔴 Expired
⚪ Information Unavailable
```

---

## 🔄 Return Information

Where return information is available, LifeReceipt can maintain:

* Return window
* Return deadline
* Return status
* Purchase information
* Supporting documents

This allows return-related information to remain associated with the original product purchase.

---

## 🔧 Service & Maintenance Tracking

Products can accumulate service and maintenance events throughout their lifetime.

LifeReceipt can maintain information such as:

* Service date
* Service provider
* Service type
* Repair details
* Maintenance details
* Replacement parts
* Service cost
* Notes
* Supporting documents

Example:

```text
Purchase
   ↓
Warranty
   ↓
Service Visit
   ↓
Repair
   ↓
Part Replacement
   ↓
Maintenance
   ↓
Current Product Status
```

---

## 💰 Total Cost of Ownership

LifeReceipt goes beyond the original purchase price.

The ownership cost can include:

```text
Purchase Cost
      +
Repair Cost
      +
Maintenance Cost
      +
Other Ownership Expenses
      =
Total Cost of Ownership
```

This provides users with a broader view of how much a product has actually cost throughout its ownership.

---

## 📧 Gmail Receipt Intelligence

LifeReceipt can connect to Gmail using **Google OAuth 2.0**.

The integration is designed specifically around purchase-related email intelligence.

Users do not provide their Gmail password to LifeReceipt.

The flow is:

```text
User
  ↓
Connect Gmail
  ↓
Google OAuth 2.0
  ↓
Read-Only Gmail Authorization
  ↓
Relevant Purchase Email Detection
  ↓
Receipt / Invoice Identification
  ↓
AI Information Extraction
  ↓
Duplicate / Conflict Detection
  ↓
Ownership Record
```

The Gmail integration focuses on relevant purchase information rather than presenting the user's entire inbox as application data.

### Gmail Integration Features

* Google OAuth 2.0
* Gmail read-only access
* Purchase-related email filtering
* Receipt and invoice detection
* AI-based information extraction
* Source traceability
* Duplicate detection
* Conflict detection
* User-specific data isolation

---

# 🤝 AI Ownership Assistant

LifeReceipt provides an AI assistant that works with the user's available ownership information.

Users can ask natural-language questions such as:

```text
"What products do I own?"

"When does my laptop warranty expire?"

"How much did I pay for this product?"

"Show me the service history."

"How much have I spent repairing this product?"

"Which documents belong to this purchase?"

"Do I have a warranty document for this product?"
```

The assistant is designed around the user's LifeReceipt data rather than unrelated general conversation.

The basic flow is:

```text
User Question
      ↓
Identify Relevant Ownership Context
      ↓
Retrieve Available Information
      ↓
AI Processing
      ↓
Context-Aware Response
```

If required information is not available, the system should not fabricate the missing value.

---

# 🪪 Digital Ownership Passport

Every product can be represented through a digital ownership passport.

The passport brings important product information together in one place.

```text
┌─────────────────────────────────┐
│     DIGITAL OWNERSHIP PASSPORT  │
├─────────────────────────────────┤
│ Product Information             │
│ Purchase Information            │
│ Warranty                        │
│ Documents                       │
│ Service History                 │
│ Maintenance History             │
│ Ownership Timeline              │
│ Cost Information                │
│ Transfer Information            │
└─────────────────────────────────┘
```

This creates a structured digital identity for the product throughout its ownership lifecycle.

---

# 🔄 Ownership Timeline

LifeReceipt maintains the lifecycle of a product as a chronological sequence of events.

Example:

```text
Purchase
   │
   ▼
Warranty Started
   │
   ▼
Service Visit
   │
   ▼
Repair
   │
   ▼
Maintenance
   │
   ▼
Ownership Transfer
   │
   ▼
Current Ownership
```

This provides users with a complete historical view of their product.

---

# 🔁 Ownership Transfer

Products can eventually be sold or transferred to another person.

LifeReceipt provides a structured foundation for maintaining transfer-related information such as:

* Original purchase
* Purchase evidence
* Warranty
* Service history
* Product documents
* Ownership timeline
* Transfer information

The concept is:

```text
Original Purchase
       ↓
Current Owner
       ↓
Ownership Transfer
       ↓
New Owner
```

This can make product ownership information easier to preserve during resale or transfer.

---

# 🔔 Smart Alerts

LifeReceipt can surface important ownership events such as:

* Warranty expiry
* Warranty approaching expiry
* Return deadlines
* Maintenance events
* Service-related events
* Important ownership documents

The objective is to help users move from simply storing information to acting on important ownership events.

---

# 🔎 Search & Organization

As the number of owned products increases, finding information becomes increasingly important.

LifeReceipt provides organized access to:

* Products
* Documents
* Warranty information
* Purchase records
* Service history
* Maintenance records
* Ownership events

Users can manage their ownership information without manually searching through multiple folders or email conversations.

---

# 📊 Ownership Analytics

LifeReceipt provides an overview of the user's ownership data.

Examples include:

```text
Total Products
Total Purchase Value
Active Warranties
Expiring Warranties
Service Expenses
Maintenance Expenses
Total Ownership Cost
```

This gives users a high-level understanding of their digital ownership portfolio.

---

# 🇮🇳 India-First Design

LifeReceipt is designed with Indian purchasing and billing formats in mind.

## Currency

The platform uses:

```text
₹ INR
```

Examples:

```text
₹49,999
₹1,25,000
₹8,499
```

---

## Indian Invoice Formats

The system is designed to recognize Indian purchase information such as:

* ₹
* Rs.
* INR
* GST
* GSTIN
* CGST
* SGST
* IGST

This makes the platform suitable for Indian receipts and invoices.

---

# 🔍 Source Traceability

One of the important principles of LifeReceipt is maintaining a relationship between extracted information and its source.

For example:

```text
Purchase Price
      ↓
Receipt / Invoice
      ↓
Extracted Information
      ↓
Ownership Record
```

This allows important ownership information to remain connected to the document or source from which it originated.

---

# ⚠️ Duplicate & Conflict Detection

LifeReceipt can encounter the same purchase through multiple sources.

For example:

```text
Receipt
Purchase Price → ₹49,999

Email
Purchase Price → ₹50,999
```

Instead of silently assuming that one value is correct, the system can identify a potential conflict.

Similarly, duplicate purchase information can be identified when the same purchase appears through multiple sources.

This is particularly useful for Gmail-based purchase ingestion.

---

# 🧠 Complete Product Flow

The overall LifeReceipt workflow is:

```text
                         ┌──────────────┐
                         │     USER     │
                         └───────┬──────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
        ┌─────────────────┐             ┌─────────────────┐
        │ Manual Upload   │             │ Gmail Connect   │
        │ Receipt/Invoice │             │ Google OAuth    │
        └────────┬────────┘             └────────┬────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
                       ┌──────────────────┐
                       │ Document / Email │
                       │    Processing    │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │   Gemini AI      │
                       │    Extraction    │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │ Structured Data  │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │ Ownership Record │
                       └────────┬─────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
       🛡️ Warranty        🔧 Service          📄 Documents
            │                   │                   │
            ▼                   ▼                   ▼
       🔄 Returns         🧰 Maintenance       📚 Records
            │                   │                   │
            └───────────────────┼───────────────────┘
                                ▼
                       ┌──────────────────┐
                       │ Ownership        │
                       │ Timeline         │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │ Cost & Analytics │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │ AI Assistant     │
                       └──────────────────┘
```

---

# 🧠 AI Processing Flow

The document intelligence pipeline works conceptually as follows:

```text
Receipt / Invoice / Document
            ↓
     File Validation
            ↓
    Document Processing
            ↓
       Gemini AI
            ↓
    Information Extraction
            ↓
      Data Validation
            ↓
   Structured Ownership Data
            ↓
      Product Record
```

The AI can extract information such as:

```text
Product
Brand
Model
Purchase Date
Purchase Price
Seller
Quantity
Warranty
Invoice Number
GST Information
```

Missing information is not intentionally replaced with fabricated values.

---

# 📧 Gmail Intelligence Flow

```text
             User
               │
               ▼
        Connect Gmail
               │
               ▼
       Google OAuth 2.0
               │
               ▼
       Read-Only Access
               │
               ▼
     Relevant Email Filtering
               │
               ▼
    Purchase Email Identification
               │
               ▼
      Receipt / Invoice Data
               │
               ▼
          Gemini AI
               │
               ▼
       Structured Purchase
               │
          ┌────┴────┐
          ▼         ▼
      Duplicate   Conflict
       Check       Check
          │         │
          └────┬────┘
               ▼
       Ownership Record
```

---

# 🏗️ System Architecture

LifeReceipt uses a separated full-stack architecture.

```text
                         USER
                           │
                           ▼
                ┌─────────────────────┐
                │ React + Vite        │
                │ Frontend            │
                │ Netlify             │
                └──────────┬──────────┘
                           │ HTTPS
                           ▼
                ┌─────────────────────┐
                │ Node.js + Express   │
                │ REST API            │
                │ Railway             │
                └───────┬─────┬───────┘
                        │     │
              ┌─────────┘     └──────────────┐
              ▼                              ▼
      ┌─────────────────┐          ┌─────────────────┐
      │ MongoDB Atlas   │          │ Google Gemini   │
      │ Database        │          │ AI Processing   │
      └─────────────────┘          └─────────────────┘
                                             │
                                             │
                                      ┌──────▼──────┐
                                      │ AI Document │
                                      │ Intelligence│
                                      └─────────────┘

                        External Integration
                               │
                               ▼
                     ┌───────────────────┐
                     │ Google Gmail API  │
                     │ OAuth 2.0         │
                     └───────────────────┘
```

---

# 🗂️ Data Relationship

The platform revolves around the relationship between users, products, documents, ownership events, and external sources.

```text
                         USER
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       PRODUCTS        DOCUMENTS      EMAIL CONNECTION
          │                │
          ▼                ▼
   OWNERSHIP DATA     SOURCE DATA
          │
    ┌─────┼──────┬────────────┐
    │     │      │            │
    ▼     ▼      ▼            ▼
Warranty Service Costs    Timeline
    │     │      │            │
    └─────┴──────┴────────────┘
                  │
                  ▼
             AI ASSISTANT
```

---

# ✨ Additional Features

Beyond basic receipt extraction, LifeReceipt includes several additional ownership intelligence capabilities.

### 📎 Document Association

Documents can be associated with specific products and ownership records.

### 🔗 Source Traceability

Extracted purchase information can remain connected to its source document or email.

### 🔍 Duplicate Detection

Potentially duplicated purchase information can be identified when multiple sources refer to the same transaction.

### ⚠️ Conflict Detection

Conflicting information from different sources can be surfaced instead of silently overwriting data.

### 🕒 Ownership Timeline

Important product events can be maintained chronologically.

### 📊 Cost Tracking

Purchase, repair, and maintenance-related costs can contribute to the ownership cost view.

### 🪪 Digital Ownership Passport

Important ownership information can be represented through a consolidated product passport.

### 📱 Mobile-Ready Experience

The application is designed to work across desktop and mobile devices through a responsive and PWA-oriented interface.

### 🔐 User Data Isolation

Ownership information is associated with authenticated users to keep records separated between accounts.

---

# 🛠️ Technologies Used

## Frontend

* React
* Vite
* JavaScript
* Responsive UI
* Progressive Web App capabilities

## Backend

* Node.js
* Express.js
* REST API
* JWT Authentication
* Document Processing
* OAuth Integration

## Database

* MongoDB
* MongoDB Atlas

## Artificial Intelligence

* Google Gemini API
* Multimodal document understanding
* Structured information extraction
* Context-aware AI assistance

## Google Integration

* Google OAuth 2.0
* Gmail API
* Gmail Read-Only Access

## Deployment

* Netlify — Frontend
* Railway — Backend
* MongoDB Atlas — Database

---

# 📁 Project Structure

```text
LifeRecipt/
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│
├── .gitignore
├── package.json
└── README.md
```

---

# 🔐 Security & Privacy

LifeReceipt follows a security-conscious architecture for handling user ownership information.

### Authentication

Protected application resources require authenticated users.

### Gmail Authentication

Gmail access uses **Google OAuth 2.0**.

LifeReceipt does not ask users to provide:

```text
Gmail Password
       or
Google OTP
```

inside the application.

### Server-Side Secrets

Sensitive credentials such as:

* Database credentials
* JWT secrets
* Gemini API keys
* Google OAuth credentials
* Encryption keys

are intended to remain server-side and outside the public repository.

### User Isolation

User ownership information is associated with authenticated accounts so that one user's ownership records are not intended to be exposed to another user.

---

# 🌐 Live Production System

LifeReceipt is currently deployed as a working production application.

### Frontend

🚀 https://life-recipt.netlify.app/

### Backend

⚙️ https://liferecipt-production.up.railway.app

### API Health

❤️ https://liferecipt-production.up.railway.app/api/v1/health

### Source Code

💻 https://github.com/Thanesh16/LifeRecipt

---

# 🎯 Example Ownership Lifecycle

Consider purchasing a laptop.

### Step 1 — Purchase

The user uploads the invoice or receipt.

```text
Laptop
₹75,000
Purchase Date
Seller
Invoice
```

### Step 2 — AI Extraction

Gemini extracts the available information from the document.

### Step 3 — Ownership Record

LifeReceipt creates a structured laptop ownership record.

### Step 4 — Warranty

The warranty information is associated with the laptop.

### Step 5 — Service

Six months later, the user adds a service event.

```text
Service
₹2,500
```

### Step 6 — Cost Tracking

The ownership cost becomes:

```text
₹75,000 Purchase
+
₹2,500 Service
=
₹77,500 Ownership Cost
```

### Step 7 — Ownership History

The entire lifecycle remains associated with the same product.

```text
Purchase
   ↓
Warranty
   ↓
Service
   ↓
Maintenance
   ↓
Current Ownership
```

This demonstrates how LifeReceipt turns a single receipt into a complete digital ownership lifecycle.

---

# 💡 Why LifeReceipt?

Traditional receipt applications focus primarily on:

> **"Where is my receipt?"**

LifeReceipt focuses on:

> **"What does this receipt mean for the entire lifecycle of my product?"**

The platform connects:

```text
Purchase
   ↓
Ownership
   ↓
Warranty
   ↓
Returns
   ↓
Service
   ↓
Maintenance
   ↓
Cost
   ↓
Ownership History
   ↓
Transfer
```

This makes LifeReceipt more than a receipt storage application.

It is designed as a **digital ownership intelligence platform**.

---

# 🔮 Future Scope

LifeReceipt can be extended with additional capabilities such as:

* More email providers
* Additional document formats
* Improved product identification
* Manufacturer information
* Authorized service-center discovery
* Product-specific support information
* Advanced ownership analytics
* Repair-versus-replacement analysis
* Enhanced ownership transfer workflows
* Digital product provenance
* Retailer integrations
* Manufacturer integrations
* Service-provider integrations
* Advanced AI-powered ownership insights

The long-term goal is to create a broader **digital infrastructure for physical product ownership**.

---

# 🏆 Conclusion

LifeReceipt demonstrates how AI can transform ordinary purchase documents into useful, persistent, and actionable ownership intelligence.

Instead of allowing receipts, invoices, warranty information, service records, and purchase emails to remain scattered across different locations, LifeReceipt brings them together into one connected ownership lifecycle.

```text
Receipt
   ↓
AI Extraction
   ↓
Digital Product
   ↓
Warranty
   ↓
Service
   ↓
Maintenance
   ↓
Cost
   ↓
Ownership Timeline
   ↓
Digital Ownership Passport
   ↓
AI Ownership Assistant
```

### 🧾 LifeReceipt

> **From a receipt to a complete digital ownership lifecycle.**

---

# 👨‍💻 Developer

## Thanesh S

Computer Science Engineering Student

Interested in:

* Artificial Intelligence
* Data Science
* Machine Learning
* Full-Stack Development
* Product Engineering

### 🔗 Links

* 💻 GitHub: [Thanesh16](https://github.com/Thanesh16)
* 🚀 Live Project: [LifeReceipt](https://life-recipt.netlify.app/)
* 📧 Email: [thaneshselvam4@gmail.com](mailto:thaneshselvam4@gmail.com)

---

<div align="center">

## 🧾 LifeReceipt

### AI-Powered Digital Ownership Intelligence

**Built with React, Node.js, MongoDB, Google Gemini and Google APIs.**

⭐ **Explore the project and experience the complete digital ownership lifecycle.**

</div>
