const fs = require('fs');
const path = require('path');
const matter = require('front-matter');

// Configuration
const POSTS_DIR = '_posts';
const README_FILE = 'README.md';
const MAX_POSTS = 5; // Number of latest posts to show

function getPostsData() {
  const posts = [];
  
  // Check if posts directory exists
  if (!fs.existsSync(POSTS_DIR)) {
    console.log('Posts directory not found. Checking for Jekyll site structure...');
    return [];
  }
  
  // Read all files in the posts directory
  const files = fs.readdirSync(POSTS_DIR);
  
  for (const file of files) {
    if (path.extname(file) === '.md') {
      const filePath = path.join(POSTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Parse front matter
        const parsed = matter(content);
        const frontMatter = parsed.attributes;
        
        // Extract date from filename (Jekyll convention: YYYY-MM-DD-title.md)
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        const dateFromFilename = dateMatch ? dateMatch[1] : null;
        
        // Use date from front matter or filename
        const postDate = frontMatter.date || dateFromFilename;
        
        if (postDate) {
          // Extract title and create URL matching your format
          const title = frontMatter.title || extractTitleFromContent(parsed.body);
          
          // Extract slug from filename (remove date prefix and .md extension)
          let slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
          
          // Format date as DD-MM-YYYY to match your URL pattern
          const date = new Date(postDate);
          const formattedDate = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-');
          
          // Create URL in your format: slug-DD-MM-YYYY/
          const url = `https://signaltosoftware.com/${slug}-${formattedDate}/`;
          
          posts.push({
            title,
            url,
            date: date,
            filename: file
          });
        }
      } catch (error) {
        console.warn(`Error parsing ${file}:`, error.message);
      }
    }
  }
  
  // Sort posts by date (newest first)
  return posts.sort((a, b) => b.date - a.date).slice(0, MAX_POSTS);
}

function extractTitleFromContent(content) {
  // Try to extract title from first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  
  // Fallback: use first line if it looks like a title
  const lines = content.split('\n').filter(line => line.trim());
  return lines[0] ? lines[0].trim() : 'Untitled Post';
}

function formatPostsForReadme(posts) {
  if (posts.length === 0) {
    return '- No posts available yet';
  }
  
  return posts.map(post => {
    // URL is already formatted correctly in getPostsData()
    return `- [${post.title}](${post.url})`;
  }).join('\n');
}

function updateReadme(posts) {
  let readmeContent = fs.readFileSync(README_FILE, 'utf8');
  
  // Find the blog posts section
  const blogStartMarker = '### 📕 Latest Blog Post';
  const nextSectionMarker = '### 📖 Currently Reading';
  
  const startIndex = readmeContent.indexOf(blogStartMarker);
  const endIndex = readmeContent.indexOf(nextSectionMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find blog posts section markers in README.md');
    return false;
  }
  
  // Generate new blog posts section
  const newBlogSection = `${blogStartMarker}\n${formatPostsForReadme(posts)}\n`;
  
  // Replace the blog posts section
  const beforeSection = readmeContent.substring(0, startIndex);
  const afterSection = readmeContent.substring(endIndex);
  
  const newReadmeContent = beforeSection + newBlogSection + afterSection;
  
  // Write updated README
  fs.writeFileSync(README_FILE, newReadmeContent, 'utf8');
  console.log('README.md updated successfully!');
  return true;
}

// Main execution
function main() {
  console.log('Fetching latest posts...');
  const posts = getPostsData();
  
  console.log(`Found ${posts.length} posts:`);
  posts.forEach(post => {
    console.log(`- ${post.title} (${post.date.toISOString().split('T')[0]})`);
  });
  
  if (updateReadme(posts)) {
    console.log('README update completed successfully!');
  } else {
    console.error('Failed to update README');
    process.exit(1);
  }
}

main();
