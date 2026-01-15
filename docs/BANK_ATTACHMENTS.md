# Bank Transaction Attachments Feature

## Overview
The bank transaction attachments feature allows users to upload, view, download, and delete file attachments associated with each bank transaction. This is useful for storing invoices, receipts, bank statements, and other supporting documents.

## Implementation Details

### Database Changes
- **Migration File**: `migrations/003_add_bank_transaction_attachments.sql`
- **New Table**: `bank_transaction_attachments`
  - Stores metadata about uploaded files
  - Links to bank transactions via `bank_transaction_id`
  - Tracks who uploaded each file and when
  - Supports multi-tenancy with `company_id`

### Backend Changes

#### Dependencies
- Added `multer` package for handling multipart/form-data file uploads

#### File Storage
- Files are stored in: `uploads/bank_attachments/`
- Filenames are automatically generated with unique suffixes to prevent collisions
- Original filenames are preserved in the database

#### API Endpoints

1. **Upload Attachment**
   - `POST /api/bank/transactions/:id/attachments`
   - Requires authentication and `bank.view` permission
   - Max file size: 10MB
   - Allowed file types: images (jpg, png, gif), PDF, DOC, DOCX, XLS, XLSX, CSV, TXT
   - Returns the created attachment record

2. **Get Attachments**
   - `GET /api/bank/transactions/:id/attachments`
   - Returns all attachments for a specific transaction
   - Includes uploader information

3. **Download Attachment**
   - `GET /api/bank/attachments/:attachmentId/download`
   - Streams the file with original filename
   - Validates company access before allowing download

4. **Delete Attachment**
   - `DELETE /api/bank/attachments/:attachmentId`
   - Deletes both database record and physical file
   - Requires authentication and `bank.view` permission
   - Logs deletion in audit trail

### Frontend Changes

#### UI Components
- **Attachments Column**: Added to the bank transactions table
  - Shows 📎 icon with count of attachments
  - Click to open attachments modal

- **Attachments Modal**: Full-featured attachment management interface
  - Drag-and-drop file upload
  - Click-to-browse file selection
  - List view of all attachments with file icons
  - File metadata display (size, uploader, date)
  - Download and delete actions per attachment

#### Features
- Real-time file validation (type and size)
- Visual drag-and-drop feedback
- Automatic file icon detection based on extension
- Human-readable file size formatting
- Responsive modal design

## Usage

### Uploading an Attachment
1. Click the 📎 button in the Attachments column for any transaction
2. Either:
   - Click the upload area and browse for a file
   - Drag and drop a file onto the upload area
3. File is validated and uploaded automatically
4. Attachment appears in the list immediately

### Viewing Attachments
1. Click the 📎 button to open the attachments modal
2. All attachments are listed with details
3. Badge on button shows total count

### Downloading an Attachment
1. Open the attachments modal
2. Click "Download" on any attachment
3. File downloads with original filename

### Deleting an Attachment
1. Open the attachments modal
2. Click "Delete" on any attachment
3. Confirm the deletion
4. Attachment is removed from both database and disk

## Security Considerations
- All operations require authentication
- Multi-tenant isolation enforced at database level
- File type validation prevents executable uploads
- File size limits prevent disk exhaustion
- Audit logging tracks all attachment operations
- File paths are not exposed to frontend
- Downloads validated against user's company access

## Future Enhancements
- Image preview/thumbnail generation
- Inline PDF viewer
- Bulk upload support
- Attachment search/filtering
- File versioning
- OCR for automatic data extraction
- Integration with AI for document analysis
