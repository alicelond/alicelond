const fs = require('fs');
const https = require('https');

// Configuration
const BLOG_REPO = 'alicelond/alicelond.github.io';
const GITHUB_API_URL = `https://api.github.com/repos/${BLOG_REPO}/contents/_posts`;
const README_FILE = 'README.md';
const MAX_POSTS = 5;

function fetchFromGitHub(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'GitHub-Action-README-Update'
      }
    }, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          if (response.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API returned ${response.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function fetchFileContent(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'GitHub-Action-README-Update'
      }
    }, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch file: ${response.statusCode}`));
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('File fetch timeout'));
    });
  });
}

function parseFrontMatter(content) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return { attributes: {}, body: content };
  }
  
  const frontMatter = {};
  const yamlContent = match[1];
  const body = match[2];
  
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      frontMatter[key] = value;
    }
  }
  
  return { attributes: frontMatter, body };
}

function extractTitleFromContent(content) {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  return lines[0] ? lines[0].trim() : 'Untitled Post';
}

async function getPostsData() {
  const posts = [];
  
  try {
    console.log('Fetching posts from GitHub API...');
    const files = await fetchFromGitHub(GITHUB_API_URL);
    
    console.log(`Found ${files.length} files in _posts directory`);
    console.log('Files:', files.map(f => f.name).join(', '));
    
    for (const file of files) {
      console.log(`\n--- Processing file: ${file.name} ---`);
      
      if (file.name.endsWith('.md')) {
        try {
          console.log(`✓ Markdown file detected: ${file.name}`);
          console.log(`Download URL: ${file.download_url}`);
          
          const content = await fetchFileContent(file.download_url);
          console.log(`✓ Content fetched, length: ${content.length} characters`);
          console.log(`First 200 chars: ${content.substring(0, 200)}...`);
          
          const parsed = parseFrontMatter(content);
          console.log(`✓ Front matter parsed:`, parsed.attributes);
          
          const frontMatter = parsed.attributes;
          
          const dateMatch = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
          const dateFromFilename = dateMatch ? dateMatch[1] : null;
          console.log(`Date from filename: ${dateFromFilename}`);
          console.log(`Date from front matter: ${frontMatter.date}`);
          
          const postDate = frontMatter.date || dateFromFilename;
          console.log(`Final post date: ${postDate}`);
          
          if (postDate) {
            const title = frontMatter.title || extractTitleFromContent(parsed.body);
            console.log(`Post title: ${title}`);
            
            let slug = file.name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
            console.log(`Slug: ${slug}`);
            
            const date = new Date(postDate);
            console.log(`Date object: ${date}`);
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const formattedDate = `${day}-${month}-${year}`;
            console.log(`Formatted date: ${formattedDate}`);
            
            const url = `https://signaltosoftware.com/${slug}-${formattedDate}/`;
            console.log(`Generated URL: ${url}`);
            
            posts.push({
              title,
              url,
              date: date,
              filename: file.name
            });
            
            console.log(`✅ Successfully added post: ${title}`);
          } else {
            console.log(`❌ No valid date found for ${file.name}`);
          }
        } catch (error) {
          console.warn(`⚠ Error parsing ${file.name}: ${error.message}`);
          console.warn(`Error stack: ${error.stack}`);
        }
      } else {
        console.log(`⚠ Skipping non-markdown file: ${file.name}`);
      }
    }
    
    console.log(`\n📊 Total posts processed: ${posts.length}`);
    
  } catch (error) {
    console.error('❌ Error fetching posts from GitHub:', error.message);
    console.error('Error stack:', error.stack);
    return [];
  }
  
  return posts.sort((a, b) => b.date - a.date).slice(0, MAX_POSTS);
}

function formatPostsForReadme(posts) {
  if (posts.length === 0) {
    return '- No posts available yet';
  }
  
  return posts.map(post => `- [${post.title}](${post.url})`).join('\n');
}

function updateReadme(posts) {
  try {
    let readmeContent = fs.readFileSync(README_FILE, 'utf8');
    
    const blogStartMarker = '### 📕 Latest Blog Post';
    const nextSectionMarker = '### 📖 Currently Reading';
    
    const startIndex = readmeContent.indexOf(blogStartMarker);
    const endIndex = readmeContent.indexOf(nextSectionMarker);
    
    if (startIndex === -1 || endIndex === -1) {
      console.error('Could not find blog posts section markers in README.md');
      return false;
    }
    
    const newBlogSection = `${blogStartMarker}\n${formatPostsForReadme(posts)}\n`;
    const beforeSection = readmeContent.substring(0, startIndex);
    const afterSection = readmeContent.substring(endIndex);
    const newReadmeContent = beforeSection + newBlogSection + afterSection;
    
    fs.writeFileSync(README_FILE, newReadmeContent, 'utf8');
    console.log('✓ README.md updated successfully!');
    return true;
  } catch (error) {
    console.error('Error updating README:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Starting README update...');
    console.log(`📡 Fetching latest posts from ${BLOG_REPO}...`);
    
    const posts = await getPostsData();
    
    console.log(`\n📝 Found ${posts.length} posts:`);
    posts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title} (${post.date.toISOString().split('T')[0]})`);
    });
    
    if (updateReadme(posts)) {
      console.log('\n✅ README update completed successfully!');
    } else {
      console.error('\n❌ Failed to update README');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

main();
